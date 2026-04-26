// ===== TechZone Admin Data Engine - HTML Sanitizer =====
// Shared legacy-admin HTML sanitization helpers.

const BLOCKED_CONTENT_TAG_PATTERN = /<\s*(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_SINGLE_TAG_PATTERN = /<\s*(script|iframe|object|embed|style|link|meta|base)\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_ATTR_PATTERN = /\s+on[a-z-]+\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi;
const SRCDOC_ATTR_PATTERN = /\s+srcdoc\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi;
const URL_ATTR_PATTERN =
    /\s+(href|src|action|formaction|xlink:href)\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\s>]+))/gi;
const STYLE_ATTR_PATTERN = /\s+style\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)')/gi;

/**
 * Checks whether a URL-like attribute value is safe for legacy admin HTML.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeAdminHtmlUrl(value) {
    const candidate = String(value || '').trim();
    if (!candidate) return false;
    if (/^(#|\/|\.\/|\.\.\/|\?|\/\/)/.test(candidate)) return true;
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(candidate)) return true;

    const protocolMatch = candidate.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!protocolMatch) return true;

    return ['http', 'https', 'mailto', 'tel'].includes(protocolMatch[1].toLowerCase());
}

/**
 * Removes dangerous inline style payloads from legacy admin markup.
 *
 * @param {string} value
 * @returns {string}
 */
export function sanitizeAdminInlineStyle(value) {
    const styleValue = String(value || '').trim();
    if (!styleValue) return '';
    return /expression|javascript:|url\s*\(/i.test(styleValue) ? '' : styleValue;
}

/**
 * Sanitizes legacy admin HTML strings before they are inserted with innerHTML.
 *
 * @param {unknown} html
 * @returns {string}
 */
export function sanitizeAdminHtmlMarkup(html) {
    const markup = String(html ?? '');

    return markup
        .replace(BLOCKED_CONTENT_TAG_PATTERN, '')
        .replace(BLOCKED_SINGLE_TAG_PATTERN, '')
        .replace(EVENT_HANDLER_ATTR_PATTERN, '')
        .replace(SRCDOC_ATTR_PATTERN, '')
        .replace(URL_ATTR_PATTERN, (match, attributeName, doubleQuotedValue, singleQuotedValue, bareValue) => {
            const attributeValue = doubleQuotedValue ?? singleQuotedValue ?? bareValue ?? '';
            return isSafeAdminHtmlUrl(attributeValue) ? match : '';
        })
        .replace(STYLE_ATTR_PATTERN, (match, doubleQuotedValue, singleQuotedValue) => {
            const sanitizedValue = sanitizeAdminInlineStyle(doubleQuotedValue ?? singleQuotedValue);
            return sanitizedValue ? ` style="${sanitizedValue}"` : '';
        });
}

/**
 * Installs a guard that sanitizes every future innerHTML assignment on the provided element type.
 *
 * @param {{
 *   elementCtor?: { prototype?: Record<string, unknown> },
 *   sanitizeHtml?: (html: unknown) => string,
 * }} [input]
 * @returns {boolean}
 */
export function installSanitizedInnerHtmlGuard({
    elementCtor,
    sanitizeHtml = sanitizeAdminHtmlMarkup
} = {}) {
    const targetCtor = elementCtor;
    const targetPrototype = targetCtor?.prototype;

    if (!targetPrototype) {
        return false;
    }

    const descriptor = Object.getOwnPropertyDescriptor(targetPrototype, 'innerHTML');
    if (!descriptor?.configurable || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function') {
        return false;
    }

    if (descriptor.set.__tzSanitized === true) {
        return true;
    }

    const originalGet = descriptor.get;
    const originalSet = descriptor.set;
    const sanitizedSet = function setSanitizedInnerHtml(value) {
        originalSet.call(this, sanitizeHtml(value));
    };

    sanitizedSet.__tzSanitized = true;

    Object.defineProperty(targetPrototype, 'innerHTML', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
            return originalGet.call(this);
        },
        set: sanitizedSet
    });

    return true;
}
