/**
 * Next.js Font Compatibility Shim.
 *
 * Returns CSS variable names that match what the layout expects.
 * Actual font loading is handled by link tags in index.html.
 */

/**
 * Creates a font configuration object matching Next.js font API.
 *
 * @param {string} varName - CSS variable name
 * @returns {Function}
 */
function createFontLoader(varName) {
  return function fontLoader(options = {}) {
    const variable = options.variable || varName;
    return {
      variable,
      className: variable.replace('--', 'font-'),
      style: { fontFamily: `var(${variable})` },
    };
  };
}

export const Cairo = createFontLoader('--font-cairo');
export const Inter = createFontLoader('--font-inter');
export const Roboto = createFontLoader('--font-roboto');
export const Outfit = createFontLoader('--font-outfit');
