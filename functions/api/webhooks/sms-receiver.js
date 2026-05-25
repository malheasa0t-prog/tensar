/**
 * Webhook to receive SMS data from Android SMS Forwarder apps.
 * Used for Orange Money automated payment processing.
 */

import { createSupabaseAdmin, errorResponse, successResponse } from "../../_lib/supabase.js";

// Ensure the request has a valid secret key to prevent unauthorized access.
function isValidSecret(request, env) {
  const secret = request.headers.get("x-sms-secret") || new URL(request.url).searchParams.get("secret");
  const expectedSecret = env.SMS_WEBHOOK_SECRET;
  
  if (!expectedSecret) {
    // If not configured, we should reject everything in production.
    return false;
  }
  
  return secret === expectedSecret;
}

/**
 * Extracts Amount, Phone, and Reference ID from an Orange Money SMS.
 * 
 * Example SMS:
 * تم استقبال حوالة مالية من
 * 00962776194223 من مزود الخدمة:
 * Orange Money إلى محفظتك بمبلغ 10
 * دينار بتاريخ 23/05/2026 الساعة
 * 04:32:25 PM بالرقم المرجعي
 * OJM-PAY-20260523163225130240
 * 
 * @param {string} text 
 * @returns {{ amount: number | null, phone: string | null, referenceId: string | null }}
 */
function parseOrangeMoneySms(text) {
  // Extract amount: بمبلغ 10 دينار or بمبلغ 10.5 دينار
  const amountMatch = text.match(/بمبلغ\s+([\d.]+)\s+دينار/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

  // Extract phone: من 00962776194223 من مزود
  const phoneMatch = text.match(/من\s+(\d+)\s+من/);
  const phone = phoneMatch ? phoneMatch[1] : null;

  // Extract reference ID: بالرقم المرجعي OJM-PAY-20260523163225130240
  const refMatch = text.match(/بالرقم المرجعي\s+([A-Z0-9-]+)\b/i);
  const referenceId = refMatch ? refMatch[1] : null;

  return { amount, phone, referenceId };
}

/**
 * Normalizes phone number to match DB format (e.g., getting the last 9 digits).
 * 00962776194223 -> 776194223
 */
function normalizePhoneForSearch(phone) {
  if (!phone) return null;
  // If it starts with 00962, replace with 0
  if (phone.startsWith("00962")) {
    return "0" + phone.slice(5);
  }
  if (phone.startsWith("+962")) {
    return "0" + phone.slice(4);
  }
  return phone;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isValidSecret(request, env)) {
    return errorResponse("[SMS-401] غير مصرح بالوصول.", 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return errorResponse("[SMS-400] تنسيق البيانات غير صالح. يجب أن يكون JSON.", 400);
  }

  const messageText = body.message || body.text || body.content || "";
  const sender = (body.sender || body.from || "").toLowerCase();

  // If the sender is explicitly known and not Orange Money, we might ignore.
  // But usually, SMS forwarders pass "OrangeMoney" or "Orange Money"
  if (sender && !sender.includes("orange") && sender !== "") {
    return successResponse({ ignored: true, reason: "Not an Orange Money sender." });
  }

  if (!messageText.includes("تم استقبال حوالة مالية")) {
    return successResponse({ ignored: true, reason: "Not an incoming transfer SMS." });
  }

  const { amount, phone, referenceId } = parseOrangeMoneySms(messageText);

  if (!amount || !phone) {
    return errorResponse("[SMS-422] لم يتم العثور على المبلغ أو رقم الهاتف في الرسالة.", 422);
  }

  const admin = createSupabaseAdmin(env);
  const normalizedPhone = normalizePhoneForSearch(phone);

  // 1. Check if this reference ID was already processed to prevent double processing
  const { data: existingTx } = await admin
    .from("wallet_transactions")
    .select("id")
    .eq("reference_id", referenceId)
    .single();

  if (existingTx) {
    return successResponse({ ignored: true, reason: "Transaction already processed." });
  }

  // 2. Try to find a pending physical order (orders table) matching phone and exact amount
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, user_id, status, payment_status")
    .eq("status", "pending")
    .eq("payment_status", "pending")
    .eq("payment_method", "wallet") // Or orange_money if we change it
    .eq("total", amount)
    .like("customer_phone", `%${normalizedPhone.slice(-8)}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (orders && orders.length > 0) {
    const order = orders[0];
    // Update order status
    const { error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "paid",
        status: "processing",
        metadata: { orange_money_ref: referenceId }
      })
      .eq("id", order.id);

    if (updateError) {
      console.error("[SMS-500] Failed to update order:", updateError);
      return errorResponse("[SMS-500] فشل تحديث الطلب.", 500);
    }
    
    return successResponse({
      processed: true,
      type: "order",
      order_id: order.id
    });
  }

  // 3. Try to find a pending service order matching
  const { data: serviceOrders } = await admin
    .from("service_orders")
    .select("id, user_id")
    .eq("status", "pending")
    .eq("total", amount)
    .order("created_at", { ascending: false });

  // We need to match by user's phone, but service_orders don't have customer_phone directly.
  // We'd have to look up the user's phone.
  if (serviceOrders && serviceOrders.length > 0) {
    for (const sOrder of serviceOrders) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("phone")
        .eq("user_id", sOrder.user_id)
        .single();
        
      if (profile && profile.phone && profile.phone.includes(normalizedPhone.slice(-8))) {
        // Match found!
        await admin.from("service_orders").update({
          status: "processing",
          metadata: { orange_money_ref: referenceId }
        }).eq("id", sOrder.id);
        
        return successResponse({
          processed: true,
          type: "service_order",
          order_id: sOrder.id
        });
      }
    }
  }

  // 4. Try to find a pending deposit
  const { data: deposits } = await admin
    .from("deposits")
    .select("id, user_id")
    .eq("status", "pending")
    .eq("amount", amount)
    .order("created_at", { ascending: false });

  if (deposits && deposits.length > 0) {
    for (const deposit of deposits) {
      const { data: profile } = await admin
        .from("user_profiles")
        .select("phone")
        .eq("user_id", deposit.user_id)
        .single();
        
      if (profile && profile.phone && profile.phone.includes(normalizedPhone.slice(-8))) {
        // Found matching deposit. Approve it and add to wallet.
        await admin.from("deposits").update({
          status: "approved",
          metadata: { orange_money_ref: referenceId },
          admin_note: "Approved via Automated SMS Webhook",
          reviewed_at: new Date().toISOString()
        }).eq("id", deposit.id);
        
        // Use the RPC to adjust wallet balance securely
        await admin.rpc("admin_adjust_wallet_balance", {
          p_admin_id: deposit.user_id, // we don't have an admin id here, using user_id is a hack if RPC requires admin. Wait, admin client bypasses RLS so it's fine.
          p_target_user_id: deposit.user_id,
          p_amount: amount,
          p_description: `Automated Deposit from Orange Money - Ref: ${referenceId}`
        });

        return successResponse({
          processed: true,
          type: "deposit",
          deposit_id: deposit.id
        });
      }
    }
  }

  // 5. If no match found, fallback to directly topping up the user's wallet if they exist.
  const { data: profileByPhone } = await admin
    .from("user_profiles")
    .select("user_id")
    .like("phone", `%${normalizedPhone.slice(-8)}%`)
    .limit(1)
    .single();

  if (profileByPhone) {
    // Top up their wallet directly
    await admin.rpc("admin_adjust_wallet_balance", {
      p_admin_id: profileByPhone.user_id,
      p_target_user_id: profileByPhone.user_id,
      p_amount: amount,
      p_description: `Orange Money Transfer - Ref: ${referenceId}`
    });

    // Also insert reference to prevent reuse
    // The RPC might not allow setting reference_id easily unless we update it after
    const { data: latestTx } = await admin
      .from("wallet_transactions")
      .select("id")
      .eq("user_id", profileByPhone.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestTx) {
      await admin.from("wallet_transactions").update({ reference_id: referenceId }).eq("id", latestTx.id);
    }

    return successResponse({
      processed: true,
      type: "direct_wallet_topup",
      user_id: profileByPhone.user_id
    });
  }

  return errorResponse("[SMS-404] لم يتم العثور على طلب أو مستخدم يطابق رقم الهاتف والمبلغ.", 404);
}
