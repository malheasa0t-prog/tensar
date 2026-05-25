-- Migration: 2026-05-24-01 — wallet rollback + order state machine
--
-- Adds three RPCs to close gaps surfaced in SECURITY-AUDIT-2026-05-24:
--   1. release_service_order_wallet  — refunds a debited service order when
--      the upstream provider fails (closes the "user paid, no order" gap).
--   2. merge_service_order_metadata  — atomically merges JSON metadata so the
--      provider failure note doesn't overwrite fields set by the create RPC.
--   3. admin_set_order_status        — enforces legal status transitions and
--      a single audit log entry per change (state machine).
--
-- All RPCs are SECURITY DEFINER and revoke EXECUTE from anon/authenticated.
-- They are intended to be called from Cloudflare Functions with the
-- service-role key only.

BEGIN;

-- =====================================================================
-- 1. release_service_order_wallet
-- =====================================================================
-- Refunds a service order's wallet debit when the upstream provider fails
-- to accept the order. Idempotent: only acts on orders still in `pending`
-- with a non-zero `total` and no `external_order_id`. Repeated calls on
-- already-released or already-processing orders are no-ops.
CREATE OR REPLACE FUNCTION public.release_service_order_wallet(
  p_order_id uuid,
  p_reason   text DEFAULT 'provider_unreachable'
)
RETURNS TABLE (released boolean, refunded_amount numeric, new_balance numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order        public.service_orders%ROWTYPE;
  v_refund       numeric := 0;
  v_new_balance  numeric := 0;
BEGIN
  -- Lock the order row to serialize concurrent rollback attempts.
  SELECT * INTO v_order
  FROM public.service_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    released := false;
    refunded_amount := 0;
    new_balance := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Only release orders that are still pending and have NOT been pushed to
  -- the provider yet (no external_order_id). Anything else is a no-op.
  IF v_order.status NOT IN ('pending') OR v_order.external_order_id IS NOT NULL THEN
    released := false;
    refunded_amount := 0;
    new_balance := COALESCE(
      (SELECT balance FROM public.wallets WHERE user_id = v_order.user_id),
      0
    );
    RETURN NEXT;
    RETURN;
  END IF;

  v_refund := COALESCE(v_order.total, v_order.price, 0);

  -- Refund the wallet. Wallet row is created if missing so the math works
  -- even if the user's wallet was deleted between debit and rollback.
  INSERT INTO public.wallets (user_id, balance)
  VALUES (v_order.user_id, v_refund)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.wallets.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO public.wallet_transactions (user_id, amount, type, reference_type, reference_id, description)
  VALUES (
    v_order.user_id,
    v_refund,
    'refund',
    'service_order',
    v_order.id,
    'استرجاع تلقائي بسبب فشل المزود: ' || COALESCE(p_reason, 'unknown')
  );

  UPDATE public.service_orders
  SET status = 'failed',
      updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO public.audit_logs (action, actor_email, details, target_table, target_id)
  VALUES (
    'service_order_wallet_released',
    'system',
    jsonb_build_object(
      'reason', p_reason,
      'refunded_amount', v_refund,
      'previous_status', v_order.status
    ),
    'service_orders',
    v_order.id
  );

  released := true;
  refunded_amount := v_refund;
  new_balance := v_new_balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.release_service_order_wallet(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_service_order_wallet(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_service_order_wallet(uuid, text) TO service_role;


-- =====================================================================
-- 2. merge_service_order_metadata
-- =====================================================================
-- Atomically merges JSONB into service_orders.metadata. Avoids the
-- previous client-side overwrite that lost fields like provider_fields
-- snapshots.
CREATE OR REPLACE FUNCTION public.merge_service_order_metadata(
  p_order_id uuid,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RETURN;
  END IF;

  UPDATE public.service_orders
  SET metadata = COALESCE(metadata, '{}'::jsonb) || p_metadata,
      updated_at = now()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_service_order_metadata(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_service_order_metadata(uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_service_order_metadata(uuid, jsonb) TO service_role;


-- =====================================================================
-- 3. admin_set_order_status (state machine)
-- =====================================================================
-- Enforces legal status transitions on the `orders` table (physical orders).
-- Rejects illegal moves like delivered -> pending or cancelled -> shipped.
-- Returns the previous status so callers can short-circuit no-op writes.
CREATE OR REPLACE FUNCTION public.admin_set_order_status(
  p_order_id      uuid,
  p_new_status    text,
  p_actor_email   text DEFAULT NULL,
  p_actor_id      uuid DEFAULT NULL,
  p_reason        text DEFAULT NULL
)
RETURNS TABLE (applied boolean, previous_status text, current_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_status text;
  v_new_status  text := lower(trim(p_new_status));
  v_legal       boolean;
BEGIN
  -- Legal transition graph for physical orders.
  -- Any value not in this map is rejected.
  IF v_new_status NOT IN ('pending','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'INVALID_STATUS:%', v_new_status USING ERRCODE = '22023';
  END IF;

  SELECT lower(trim(status)) INTO v_prev_status
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_prev_status = v_new_status THEN
    applied := false;
    previous_status := v_prev_status;
    current_status := v_prev_status;
    RETURN NEXT;
    RETURN;
  END IF;

  v_legal := CASE
    WHEN v_prev_status = 'pending'    AND v_new_status IN ('processing','cancelled') THEN true
    WHEN v_prev_status = 'processing' AND v_new_status IN ('shipped','cancelled')    THEN true
    WHEN v_prev_status = 'shipped'    AND v_new_status IN ('delivered','cancelled')  THEN true
    WHEN v_prev_status = 'delivered'  AND v_new_status IN ('refunded')               THEN true
    WHEN v_prev_status = 'cancelled'  AND v_new_status IN ('refunded')               THEN true
    ELSE false
  END;

  IF NOT v_legal THEN
    RAISE EXCEPTION 'ILLEGAL_TRANSITION:%->%', v_prev_status, v_new_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = v_new_status,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.audit_logs (action, actor_email, actor_id, details, target_table, target_id)
  VALUES (
    'order_status_changed',
    p_actor_email,
    p_actor_id,
    jsonb_build_object(
      'previous_status', v_prev_status,
      'new_status', v_new_status,
      'reason', p_reason
    ),
    'orders',
    p_order_id
  );

  applied := true;
  previous_status := v_prev_status;
  current_status := v_new_status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_status(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_order_status(uuid, text, text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, text, text, uuid, text) TO service_role;

COMMIT;
