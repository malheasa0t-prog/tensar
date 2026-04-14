import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { lookupPublicOrderByNumber } from "@/services/orderLookupService";

export const dynamic = "force-dynamic";

/**
 * Parses the request body safely and returns null for invalid JSON payloads.
 *
 * @param {Request} request
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function parseLookupBody(request) {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

/**
 * Handles public order lookup requests for repair and delivery orders.
 *
 * @param {Request} request
 * @returns {Promise<NextResponse>}
 */
export async function POST(request) {
  const body = await parseLookupBody(request);

  if (!body) {
    return NextResponse.json({ error: "تعذر قراءة البيانات المرسلة." }, { status: 400 });
  }

  try {
    const result = await lookupPublicOrderByNumber({
      adminClient: supabaseAdmin,
      lookupType: typeof body.lookupType === "string" ? body.lookupType : "all",
      orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : "",
    });

    if (!result) {
      return NextResponse.json(
        { error: "لم نعثر على طلب بهذا الرقم. تأكد من الرقم ثم حاول مرة أخرى." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "تعذر إتمام الاستعلام حالياً. حاول مرة أخرى بعد قليل.";

    const status = message.includes("أدخل رقم طلب صحيح") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
