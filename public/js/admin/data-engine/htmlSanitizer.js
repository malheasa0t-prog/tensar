// ===== TechZone Admin Data Engine - HTML Sanitizer =====
// Shared legacy-admin HTML sanitization helpers.

const BLOCKED_CONTENT_TAG_PATTERN = /<\s*(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_SINGLE_TAG_PATTERN = /<\s*(script|iframe|object|embed|style|link|meta|base)\b[^>]*\/?\s*>/gi;
const EVENT_HANDLER_ATTR_PATTERN = /[\s/]+on[a-z-]+\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi;
const SRCDOC_ATTR_PATTERN = /\s+srcdoc\s*=\s*(?:"[\s\S]*?"|'[\s\S]*?'|[^\s>]+)/gi;
const URL_ATTR_PATTERN =
    /\s+(href|src|action|formaction|xlink:href)\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\s>]+))/gi;
const STYLE_ATTR_PATTERN = /\s+style\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)')/gi;
const HTML_ENTITY_PATTERN = /&(#x?[0-9a-f]+|[a-z]+);?/gi;
const HTML_ENTITY_MAP = Object.freeze({
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
});

/**
 * Decodes a minimal set of HTML entities before security checks.
 *
 * @param {string} value
 * @returns {string}
 */
function decodeAdminHtmlEntities(value) {
    return String(value || '').replace(HTML_ENTITY_PATTERN, (match, entity) => {
        const normalizedEntity = String(entity || '').trim().toLowerCase();
        if (!normalizedEntity) return match;
        if (normalizedEntity.startsWith('#x')) {
            const codePoint = parseInt(normalizedEntity.slice(2), 16);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        if (normalizedEntity.startsWith('#')) {
            const codePoint = parseInt(normalizedEntity.slice(1), 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        }

        return HTML_ENTITY_MAP[normalizedEntity] || match;
    });
}

/**
 * Removes control characters and decoded spacing tricks from URL-like input.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeAdminHtmlUrlCandidate(value) {
    return decodeAdminHtmlEntities(value).replace(/[\u0000-\u001F\u007F\s]+/g, '').trim();
}

/**
 * Checks whether a URL-like attribute value is safe for legacy admin HTML.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isSafeAdminHtmlUrl(value) {
    const candidate = normalizeAdminHtmlUrlCandidate(value);
    if (!candidate) return false;
    if (/^(#|\/|\.\/|\.\.\/|\?)/.test(candidate) || candidate.startsWith('//')) return true;
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
    const normalizedStyleValue = normalizeAdminHtmlUrlCandidate(styleValue);
    return /expression|javascript:|url\(/i.test(normalizedStyleValue) ? '' : styleValue;
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
