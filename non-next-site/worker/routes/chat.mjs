import { createPublicSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_HISTORY_MESSAGES = 10;
const MAX_RESPONSE_TOKENS = 500;

/**
 * Loads one text snapshot from a public table.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} tableName
 * @param {string} selectedColumns
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function loadPublicRows(supabase, tableName, selectedColumns) {
  const { data } = await supabase.from(tableName).select(selectedColumns).eq("status", "active");
  return Array.isArray(data) ? data : [];
}

/**
 * Builds the store context used in the AI system prompt.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<string>}
 */
async function buildStoreContext(supabase) {
  const [products, services, categories] = await Promise.all([
    loadPublicRows(supabase, "products", "name,price,quantity,brand"),
    loadPublicRows(supabase, "repair_services", "name,price,category"),
    loadPublicRows(supabase, "categories", "name,description")
  ]);

  return [
    "المنتجات:",
    ...(products.length
      ? products.map((product) => `• ${product.name} | السعر: ${product.price} د.أ | الكمية: ${product.quantity || 0}`)
      : ["• لا توجد منتجات متاحة حاليا."]),
    "",
    "خدمات الصيانة:",
    ...(services.length
      ? services.map((service) => `• ${service.name} | السعر: ${service.price} د.أ | الفئة: ${service.category || "عام"}`)
      : ["• لا توجد خدمات صيانة متاحة حاليا."]),
    "",
    "فئات المتجر:",
    ...(categories.length
      ? categories.map((category) => `• ${category.name}${category.description ? `: ${category.description}` : ""}`)
      : ["• لا توجد فئات متاحة حاليا."])
  ].join("\n");
}

/**
 * Validates one chat request body.
 *
 * @param {Record<string, unknown> | null} body
 * @returns {{ history: Array<{ content: string, role: string }>, message: string } | null}
 */
function normalizeChatBody(body) {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 500) {
    return null;
  }

  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  return { history, message };
}

/**
 * Calls Groq using OpenAI-compatible chat payloads.
 *
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {Array<{ content: string, role: string }>} messages
 * @returns {Promise<string>}
 */
async function callGroq(apiKey, systemPrompt, messages) {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: MAX_RESPONSE_TOKENS,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((message) => ({
          content: message.content,
          role: message.role === "assistant" ? "assistant" : "user"
        }))
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Failed to call Groq.");
  }

  const reply = payload?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error("Empty response from Groq.");
  }

  return String(reply).trim();
}

/**
 * Handles AI chat requests without Next.js.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleChatRequest(request, env) {
  const body = normalizeChatBody(await parseJsonBody(request));
  const apiKey = String(env?.GROQ_API_KEY || "").trim();

  if (!body) {
    return errorResponse("الرجاء إدخال رسالة صالحة.", 400);
  }
  if (!apiKey) {
    return errorResponse("GROQ_API_KEY is not configured.", 500);
  }

  try {
    const supabase = createPublicSupabaseClient(env);
    const storeContext = await buildStoreContext(supabase);
    const systemPrompt = [
      'أنت "تيك" مساعد متجر TechZone.',
      "أجب بالعربية فقط وبأسلوب مختصر ومهني.",
      "لا تخترع منتجات أو أسعار غير موجودة.",
      storeContext
    ].join("\n\n");
    const reply = await callGroq(apiKey, systemPrompt, [
      ...body.history,
      { content: body.message, role: "user" }
    ]);

    return jsonResponse({ reply });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "عذرا، حدث خطأ في المعالجة.",
      500
    );
  }
}
