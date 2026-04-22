/**
 * Cloudflare Pages Function — AI Chat API.
 *
 * Handles POST /api/chat requests by forwarding to Groq API.
 * Requires authentication to prevent abuse and API key exhaustion.
 *
 * @param {EventContext} context
 */

import { createSupabaseClient, extractBearerToken, errorResponse } from '../_lib/supabase.js';
import { handlePreflight, withCors } from '../_lib/cors.js';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_HISTORY_MESSAGES = 10;
const MAX_RESPONSE_TOKENS = 500;

/**
 * Builds the system prompt with product/service context.
 *
 * @param {string} productsContext - Formatted products list.
 * @param {string} servicesContext - Formatted services list.
 * @param {string} categoriesContext - Formatted categories list.
 * @returns {string} The system prompt.
 */
function buildSystemPrompt(productsContext, servicesContext, categoriesContext) {
  return `أنت "تيك" — مساعد الدعم الفني الذكي لمتجر TechZone للإلكترونيات.

═══════════════════════════════
📦 المنتجات المتاحة حالياً:
═══════════════════════════════
${productsContext}

═══════════════════════════════
🔧 خدمات الصيانة المتاحة:
═══════════════════════════════
${servicesContext}

═══════════════════════════════
📂 فئات المتجر:
═══════════════════════════════
${categoriesContext}

═══════════════════════════════
📋 قواعدك الأساسية:
═══════════════════════════════
1. أجب دائماً بالعربية بأسلوب ودي ومهني.
2. أجب فقط من البيانات المتاحة أعلاه.
3. إذا سأل العميل عن منتج غير موجود، اعتذر واقترح بدائل.
4. إذا سأل عن أسعار، اذكرها بالدينار الأردني (د.أ).
5. كن مختصراً.
6. لا تجب على أسئلة خارج نطاق المتجر.`;
}

/**
 * Fetches live data context from Supabase for the AI prompt.
 *
 * @param {string} supabaseUrl - The Supabase project URL.
 * @param {string} supabaseKey - The anon key.
 * @returns {Promise<{products: string, services: string, categories: string}>}
 */
async function fetchDataContext(supabaseUrl, supabaseKey) {
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const [productsRes, servicesRes, categoriesRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/products?status=eq.active&select=name,description,price,quantity,brand,category_id`, { headers })
      .then((response) => response.json())
      .catch(() => []),
    fetch(`${supabaseUrl}/rest/v1/repair_services?status=eq.active&select=name,description,price,category,duration`, { headers })
      .then((response) => response.json())
      .catch(() => []),
    fetch(`${supabaseUrl}/rest/v1/categories?status=eq.active&select=name,description`, { headers })
      .then((response) => response.json())
      .catch(() => []),
  ]);

  return {
    products: Array.isArray(productsRes) && productsRes.length > 0
      ? productsRes.map((item) => `• ${item.name} | ${item.price} د.أ | ${item.quantity > 0 ? 'متوفر' : 'نفد'}`).join('\n')
      : 'لا توجد منتجات.',
    services: Array.isArray(servicesRes) && servicesRes.length > 0
      ? servicesRes.map((item) => `• ${item.name} | ${item.price} د.أ | ${item.category || 'عام'}`).join('\n')
      : 'لا توجد خدمات.',
    categories: Array.isArray(categoriesRes) && categoriesRes.length > 0
      ? categoriesRes.map((item) => `• ${item.name}`).join('\n')
      : 'لا توجد فئات.',
  };
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const token = extractBearerToken(request);
    if (!token) {
      return withCors(errorResponse('[BOT-201] يجب تسجيل الدخول لاستخدام المحادثة.', 401), request);
    }

    const supabase = createSupabaseClient(env);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return withCors(errorResponse('[BOT-202] جلسة غير صالحة. أعد تسجيل الدخول.', 401), request);
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

    if (!message) {
      return withCors(errorResponse('[BOT-101] الرجاء إدخال رسالة.', 400), request);
    }

    if (message.length > 500) {
      return withCors(errorResponse('[BOT-102] الرسالة طويلة جداً. الحد الأقصى 500 حرف.', 400), request);
    }

    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return withCors(errorResponse('[BOT-500] AI service not configured.', 500), request);
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    const ctx = await fetchDataContext(supabaseUrl, supabaseKey);
    const systemPrompt = buildSystemPrompt(ctx.products, ctx.services, ctx.categories);
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((item) => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content })),
      { role: 'user', content: message },
    ];

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: allMessages,
        max_tokens: MAX_RESPONSE_TOKENS,
        temperature: 0.7,
      }),
    });

    if (!groqResponse.ok) {
      return withCors(errorResponse('[BOT-401] AI service error.', 502), request);
    }

    const data = await groqResponse.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return withCors(errorResponse('[BOT-402] Empty AI response.', 502), request);
    }

    return withCors(Response.json({ reply }), request);
  } catch (error) {
    console.error('[BOT-500] Chat API error:', error);
    return withCors(errorResponse('[BOT-500] عذراً، حدث خطأ في المعالجة.', 500), request);
  }
}

/**
 * Handles CORS preflight requests.
 *
 * @param {EventContext} context
 * @returns {Response}
 */
export function onRequestOptions(context) {
  return handlePreflight(context.request);
}
