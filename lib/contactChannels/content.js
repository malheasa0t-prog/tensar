/**
 * Normalizes editable content blocks stored inside site settings.
 */
import {
  DEFAULT_FAQS,
  DEFAULT_TESTIMONIALS,
  DEFAULT_VALUE_POINTS,
  DEFAULT_WORKING_HOURS,
} from "./contentDefaults.js";
import { cleanValue } from "./helpers.js";

/**
 * Clones a simple object list to avoid leaking shared references.
 *
 * @param {Array<Record<string, string>>} items
 * @returns {Array<Record<string, string>>}
 */
function cloneContentList(items) {
  return items.map((item) => ({ ...item }));
}

/**
 * Normalizes homepage value points.
 *
 * @param {unknown} value
 * @returns {Array<{ icon: string, title: string, description: string }>}
 */
export function normalizeValuePointList(value) {
  if (!Array.isArray(value)) {
    return cloneContentList(DEFAULT_VALUE_POINTS);
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const title = cleanValue(item.title);
      const description = cleanValue(item.description);

      if (!title || !description) {
        return null;
      }

      return {
        icon: cleanValue(item.icon) || "sparkles",
        title,
        description,
      };
    })
    .filter(Boolean);

  return items.length > 0 ? items : cloneContentList(DEFAULT_VALUE_POINTS);
}

/**
 * Normalizes customer testimonials.
 *
 * @param {unknown} value
 * @returns {Array<{ name: string, role: string, quote: string }>}
 */
export function normalizeTestimonialList(value) {
  if (!Array.isArray(value)) {
    return cloneContentList(DEFAULT_TESTIMONIALS);
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const name = cleanValue(item.name);
      const quote = cleanValue(item.quote);

      if (!name || !quote) {
        return null;
      }

      return {
        name,
        role: cleanValue(item.role),
        quote,
      };
    })
    .filter(Boolean);

  return items.length > 0 ? items : cloneContentList(DEFAULT_TESTIMONIALS);
}

/**
 * Normalizes frequently asked questions.
 *
 * @param {unknown} value
 * @returns {Array<{ question: string, answer: string }>}
 */
export function normalizeFaqList(value) {
  if (!Array.isArray(value)) {
    return cloneContentList(DEFAULT_FAQS);
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const question = cleanValue(item.question);
      const answer = cleanValue(item.answer);

      return question && answer ? { question, answer } : null;
    })
    .filter(Boolean);

  return items.length > 0 ? items : cloneContentList(DEFAULT_FAQS);
}

/**
 * Normalizes working hours entries.
 *
 * @param {unknown} value
 * @returns {Array<{ day: string, hours: string }>}
 */
export function normalizeWorkingHours(value) {
  if (!Array.isArray(value)) {
    return cloneContentList(DEFAULT_WORKING_HOURS);
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const day = cleanValue(item.day);
      const hours = cleanValue(item.hours);

      return day && hours ? { day, hours } : null;
    })
    .filter(Boolean);

  return items.length > 0 ? items : cloneContentList(DEFAULT_WORKING_HOURS);
}

/**
 * Normalizes all editable content blocks stored inside site settings.
 *
 * @param {unknown} value
 * @returns {{
 *   valuePoints: Array<{ icon: string, title: string, description: string }>,
 *   testimonials: Array<{ name: string, role: string, quote: string }>,
 *   faqs: Array<{ question: string, answer: string }>,
 *   workingHours: Array<{ day: string, hours: string }>
 * }}
 */
export function normalizeSiteContent(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    valuePoints: normalizeValuePointList(source.valuePoints),
    testimonials: normalizeTestimonialList(source.testimonials),
    faqs: normalizeFaqList(source.faqs),
    workingHours: normalizeWorkingHours(source.workingHours),
  };
}
