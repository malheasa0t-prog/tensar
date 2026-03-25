export const runtime = "nodejs";

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidPhone(phone) {
  return /^[+0-9\s()-]{7,20}$/.test(phone);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = normalizeText(body?.name);
    const phone = normalizeText(body?.phone);
    const service = normalizeText(body?.service);

    if (!name || !phone || !service) {
      return Response.json(
        { error: "الرجاء ادخال الاسم ورقم الهاتف ونوع الخدمة" },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 80) {
      return Response.json(
        { error: "الاسم يجب أن يكون بين حرفين و80 حرفاً" },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return Response.json(
        { error: "رقم الهاتف غير صالح" },
        { status: 400 }
      );
    }

    if (service.length > 120) {
      return Response.json(
        { error: "نوع الخدمة طويل جداً" },
        { status: 400 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "تم استلام الطلب",
        data: { name, phone, service }
      },
      { status: 201 }
    );
  } catch {
    return Response.json({ error: "تعذر معالجة الطلب" }, { status: 500 });
  }
}
