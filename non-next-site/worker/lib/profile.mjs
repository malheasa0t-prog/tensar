/**
 * Validates one profile update payload and returns the normalized fields.
 *
 * @param {Record<string, unknown> | null} body
 * @returns {{
 *   errors: string[],
 *   payload: {
 *     avatar_url: string | null,
 *     bio: string | null,
 *     country: string | null,
 *     full_name: string | null,
 *     phone: string | null,
 *     preferred_currency: string,
 *     preferred_language: string,
 *     updated_at: string,
 *   }
 * }}
 */
export function validateProfileInput(body) {
  const errors = [];
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : "";
  const country = typeof body?.country === "string" ? body.country.trim() : "";
  const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
  const preferredLanguage =
    typeof body?.preferred_language === "string" ? body.preferred_language.trim() : "";
  const preferredCurrency =
    typeof body?.preferred_currency === "string" ? body.preferred_currency.trim() : "";

  if (fullName && (fullName.length < 2 || fullName.length > 120)) {
    errors.push("الاسم يجب أن يكون بين حرفين و120 حرفًا");
  }

  if (phone && !/^[+0-9\s()-]{7,20}$/.test(phone)) {
    errors.push("رقم الهاتف غير صالح");
  }

  if (avatarUrl && avatarUrl.length > 2048) {
    errors.push("رابط الصورة طويل جدًا");
  }

  if (country && country.length > 80) {
    errors.push("اسم الدولة طويل جدًا");
  }

  if (bio && bio.length > 500) {
    errors.push("النبذة يجب ألا تتجاوز 500 حرف");
  }

  if (preferredLanguage && preferredLanguage.length > 12) {
    errors.push("قيمة اللغة غير صالحة");
  }

  if (preferredCurrency && preferredCurrency.length > 8) {
    errors.push("قيمة العملة غير صالحة");
  }

  return {
    errors,
    payload: {
      avatar_url: avatarUrl || null,
      bio: bio || null,
      country: country || null,
      full_name: fullName || null,
      phone: phone || null,
      preferred_currency: preferredCurrency || "JOD",
      preferred_language: preferredLanguage || "ar",
      updated_at: new Date().toISOString()
    }
  };
}
