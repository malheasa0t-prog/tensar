/**
 * Cloudflare Pages Function — AI Chat API.
 *
 * Handles POST /api/chat requests by forwarding to Groq API.
 * Replaces the Next.js API route at app/api/chat/route.js.
 *
 * @param {EventContext} context
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_HISTORY_MESSAGES = 10;
const MAX_RESPONSE_TOKENS = 500;

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

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];

    if (!message) {
      return Response.json({ error: 'الرجاء إدخال رسالة.' }, { status: 400 });
    }

    if (message.length > 500) {
      return Response.json({ error: 'الرسالة طويلة جداً. الحد الأقصى 500 حرف.' }, { status: 400 });
    }

    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'AI service not configured.' }, { status: 500 });
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

    const [productsRes, servicesRes, categoriesRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/products?status=eq.active&select=name,description,price,quantity,brand,category_id`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }).then((r) => r.json()).catch(() => []),
      fetch(`${supabaseUrl}/rest/v1/repair_services?status=eq.active&select=name,description,price,category,duration`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }).then((r) => r.json()).catch(() => []),
      fetch(`${supabaseUrl}/rest/v1/categories?status=eq.active&select=name,description`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }).then((r) => r.json()).catch(() => []),
    ]);

    const productsContext = Array.isArray(productsRes) && productsRes.length > 0
      ? productsRes.map((p) => `• ${p.name} | ${p.price} د.أ | ${p.quantity > 0 ? 'متوفر' : 'نفد'}`).join('\n')
      : 'لا توجد منتجات.';
    const servicesContext = Array.isArray(servicesRes) && servicesRes.length > 0
      ? servicesRes.map((s) => `• ${s.name} | ${s.price} د.أ | ${s.category || 'عام'}`).join('\n')
      : 'لا توجد خدمات.';
    const categoriesContext = Array.isArray(categoriesRes) && categoriesRes.length > 0
      ? categoriesRes.map((c) => `• ${c.name}`).join('\n')
      : 'لا توجد فئات.';

    const systemPrompt = buildSystemPrompt(productsContext, servicesContext, categoriesContext);

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg) => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })),
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
      return Response.json({ error: 'AI service error.' }, { status: 502 });
    }

    const data = await groqResponse.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return Response.json({ error: 'Empty AI response.' }, { status: 502 });
    }

    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: 'عذراً، حدث خطأ في المعالجة.' }, { status: 500 });
  }
}
