import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSiteContent } from "./content.js";
import { normalizeSiteSettings } from "../contactChannels.js";

test("normalizeSiteContent should keep valid editable content blocks", () => {
  const content = normalizeSiteContent({
    valuePoints: [{ icon: "shield-check", title: "تشخيص", description: "وصف واضح" }],
    testimonials: [{ name: "أحمد", role: "عميل", quote: "تجربة ممتازة" }],
    faqs: [{ question: "كم يوم؟", answer: "خلال يومين" }],
    workingHours: [{ day: "السبت", hours: "10 - 6" }],
  });

  assert.equal(content.valuePoints[0].title, "تشخيص");
  assert.equal(content.testimonials[0].quote, "تجربة ممتازة");
  assert.equal(content.faqs[0].answer, "خلال يومين");
  assert.equal(content.workingHours[0].hours, "10 - 6");
});

test("normalizeSiteSettings should expose content from settings.data.content", () => {
  const settings = normalizeSiteSettings({
    company: { name: "TechZone" },
    content: {
      valuePoints: [{ icon: "zap", title: "سرعة", description: "تنفيذ أسرع" }],
      testimonials: [{ name: "سارة", role: "مصممة", quote: "أداء ممتاز" }],
      faqs: [{ question: "هل يوجد ضمان؟", answer: "نعم" }],
      workingHours: [{ day: "الأحد", hours: "11 - 7" }],
    },
  });

  assert.equal(settings.content.valuePoints[0].title, "سرعة");
  assert.equal(settings.content.testimonials[0].name, "سارة");
  assert.equal(settings.content.faqs[0].question, "هل يوجد ضمان؟");
  assert.equal(settings.content.workingHours[0].day, "الأحد");
});

test("normalizeSiteSettings should fall back when content blocks are missing", () => {
  const settings = normalizeSiteSettings({ content: { valuePoints: [] } });

  assert.ok(settings.content.valuePoints.length > 0);
  assert.ok(settings.content.testimonials.length > 0);
  assert.ok(settings.content.faqs.length > 0);
  assert.ok(settings.content.workingHours.length > 0);
});

test("normalizeSiteSettings should expose normalized deposit transfer details", () => {
  const settings = normalizeSiteSettings({
    company: { name: "TechZone Store" },
    depositTransfer: {
      bank: "البنك العربي",
      accountNumber: "JO00 TEST 1234",
    },
  });

  assert.deepEqual(settings.depositTransfer, {
    bankName: "البنك العربي",
    accountHolder: "TechZone Store",
    iban: "JO00 TEST 1234",
    instructions: "",
  });
});
