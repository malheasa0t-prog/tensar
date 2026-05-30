-- ============================================================================
-- 2026-05-30-07  Covering indexes for foreign keys
-- ----------------------------------------------------------------------------
-- Adds the 7 missing covering indexes flagged by the Supabase performance
-- linter (unindexed_foreign_keys). Purely additive and safe to re-run.
-- Speeds up FK lookups and cascade/restrict checks as these tables grow.
-- ============================================================================

create index if not exists idx_orange_money_logs_wallet_transaction_id
  on public.orange_money_logs (wallet_transaction_id);

create index if not exists idx_platform_updates_created_by
  on public.platform_updates (created_by);

create index if not exists idx_refund_requests_reviewed_by
  on public.refund_requests (reviewed_by);

create index if not exists idx_reviews_user_id
  on public.reviews (user_id);

create index if not exists idx_support_chat_messages_sender_user_id
  on public.support_chat_messages (sender_user_id);

create index if not exists idx_support_conversations_assigned_admin_id
  on public.support_conversations (assigned_admin_id);

create index if not exists idx_wallet_transactions_wallet_id
  on public.wallet_transactions (wallet_id);
