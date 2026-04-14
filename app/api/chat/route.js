/**
 * TechZone AI Chatbot API Route — Groq Edition
 *
 * هذا الملف هو "العقل" الخلفي للشات بوت.
 * يستقبل سؤال العميل، يجلب بيانات المتجر من Supabase،
 * ثم يرسل كل شيء إلى Groq API ليولّد رداً ذكياً.
 *
 * --- كيف يعمل؟ ---
 * 1. العميل يرسل رسالة عبر fetch('/api/chat')
 * 2. الـ API يجلب المنتجات والخدمات والفئات من Supabase
 * 3. يُبني System Prompt يحتوي: بيانات المتجر + القواعد
 * 4. يرسل المحادثة إلى Groq API (نموذج Llama 3.3 70B)
 * 5. يرجع رد النموذج للعميل
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/* ─────────────── الإعدادات الثابتة ─────────────── */

/** الحد الأقصى لعدد الرسائل السابقة المرسلة كسياق */
const MAX_HISTORY_MESSAGES = 10;

/** نموذج Groq المستخدم (Llama 3.3 70B - سريع وذكي) */
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/** رابط Groq API (متوافق مع OpenAI) */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** الحد الأقصى لطول الرد */
const MAX_RESPONSE_TOKENS = 500;

/* ─────────────── جلب بيانات المتجر من Supabase ─────────────── */

/**
 * يجلب جميع المنتجات النشطة مع أسماء فئاتها.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string>} نص يحتوي بيانات المنتجات
 */
async function fetchProductsContext(supabase) {
  const { data: products } = await supabase
    .from('products')
    .select('name, description, price, quantity, brand, status, category_id, categories(name)')
    .eq('status', 'active');

  if (!products || products.length === 0) {
    return 'لا توجد منتجات متاحة حالياً.';
  }

  return products
    .map((product) => {
      const categoryName = product.categories?.name || 'غير مصنف';
      const stockStatus = product.quantity > 0 ? `متوفر (${product.quantity} قطعة)` : 'نفد من المخزون';
      const brandInfo = product.brand ? ` | الماركة: ${product.brand}` : '';
      return `• ${product.name} | السعر: ${product.price} د.أ | ${stockStatus} | الفئة: ${categoryName}${brandInfo}`;
    })
    .join('\n');
}

/**
 * يجلب جميع خدمات الصيانة النشطة.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string>} نص يحتوي بيانات الخدمات
 */
async function fetchServicesContext(supabase) {
  const { data: services } = await supabase
    .from('repair_services')
    .select('name, description, price, category, duration, status')
    .eq('status', 'active');

  if (!services || services.length === 0) {
    return 'لا توجد خدمات صيانة متاحة حالياً.';
  }

  return services
    .map((service) => {
      const duration = service.duration ? ` | المدة: ${service.duration}` : '';
      return `• ${service.name} | السعر: ${service.price} د.أ${duration} | الفئة: ${service.category || 'عام'}`;
    })
    .join('\n');
}

/**
 * يجلب فئات المنتجات.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string>} نص يحتوي أسماء الفئات
 */
async function fetchCategoriesContext(supabase) {
  const { data: categories } = await supabase
    .from('categories')
    .select('name, description')
    .eq('status', 'active');

  if (!categories || categories.length === 0) {
    return 'لا توجد فئات.';
  }

  return categories
    .map((cat) => `• ${cat.name}${cat.description ? ': ' + cat.description : ''}`)
    .join('\n');
}

/* ─────────────── بناء الـ System Prompt ─────────────── */

/**
 * يبني الـ System Prompt الذي يُعرّف شخصية البوت ويعطيه بيانات المتجر.
 *
 * @param {string} productsContext
 * @param {string} servicesContext
 * @param {string} categoriesContext
 * @returns {string}
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
2. أجب فقط من البيانات المتاحة أعلاه — لا تخترع منتجات أو أسعار غير موجودة.
3. إذا سأل العميل عن منتج غير موجود، اعتذر واقترح بدائل من المتاح.
4. إذا سأل عن أسعار، اذكرها بالدينار الأردني (د.أ).
5. إذا سأل كيف يشتري، وجّهه لتصفح المنتجات وإضافتها للسلة.
6. إذا سأل عن صيانة، اقترح حجز موعد من صفحة الخدمات.
7. كن مختصراً — لا تطل في الرد إلا إذا طُلب منك التفصيل.
8. إذا لم تعرف الإجابة، قل "يمكنك التواصل مع فريقنا عبر صفحة تواصل معنا".
9. لا تجب على أسئلة خارج نطاق المتجر (سياسة، رياضة، إلخ).`;
}

/* ─────────────── إرسال الرسالة إلى Groq API ─────────────── */

/**
 * يرسل المحادثة إلى Groq API ويعيد الرد.
 *
 * Groq API متوافق مع صيغة OpenAI:
 * - system prompt يُرسل كأول رسالة بـ role: "system"
 * - الرسائل تكون بصيغة {role: "user"/"assistant", content: "..."}
 *
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Promise<string>}
 * @throws {Error}
 */
async function callGroqAPI(systemPrompt, messages) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  // صيغة OpenAI المتوافقة: system message أولاً ثم المحادثة
  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  const requestBody = {
    model: GROQ_MODEL,
    messages: allMessages,
    max_tokens: MAX_RESPONSE_TOKENS,
    temperature: 0.7,
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API error: ${response.status} - ${errorData?.error?.message || 'Unknown error'}`
    );
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('Empty response from Groq API.');
  }

  return reply.trim();
}

/* ─────────────── التحقق من صحة الطلب ─────────────── */

/**
 * يتحقق من صحة بيانات الطلب الواردة.
 *
 * @param {object} body
 * @returns {{ valid: boolean, error?: string, message?: string, history?: Array }}
 */
function validateRequest(body) {
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

  if (!message) {
    return { valid: false, error: 'الرجاء إدخال رسالة.' };
  }

  if (message.length > 500) {
    return { valid: false, error: 'الرسالة طويلة جداً. الحد الأقصى 500 حرف.' };
  }

  return { valid: true, message, history };
}

/* ─────────────── نقطة الدخول الرئيسية (POST /api/chat) ─────────────── */

/**
 * يعالج طلبات POST الواردة من واجهة الشات.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  try {
    // 1) قراءة الطلب والتحقق منه
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 2) إنشاء عميل Supabase للقراءة فقط
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // 3) جلب بيانات المتجر بالتوازي (أسرع من واحد تلو الآخر)
    const [productsContext, servicesContext, categoriesContext] = await Promise.all([
      fetchProductsContext(supabase),
      fetchServicesContext(supabase),
      fetchCategoriesContext(supabase),
    ]);

    // 4) بناء الـ System Prompt
    const systemPrompt = buildSystemPrompt(productsContext, servicesContext, categoriesContext);

    // 5) تجهيز تاريخ المحادثة + الرسالة الجديدة
    const messages = [
      ...validation.history,
      { role: 'user', content: validation.message },
    ];

    // 6) إرسال الكل إلى Groq والحصول على الرد
    const reply = await callGroqAPI(systemPrompt, messages);

    // 7) إرجاع الرد للعميل
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'عذراً، حدث خطأ في المعالجة. حاول مرة أخرى.' },
      { status: 500 }
    );
  }
}
