/**
 * ==============================================================================
 * Rota Design System - Token to CSS Variables Converter
 * ==============================================================================
 *
 * This script transforms the design tokens from `design-tokens.tokens.json` into
 * standard, highly maintainable CSS custom properties (CSS variables).
 *
 * ARCHITECTURAL PRINCIPLE: 2-TIER COLOR SYSTEM
 * ---------------------------------------------
 * 1. TIER 1: PRIMITIVE COLORS (FOUNDATION PALETTE)
 *    - Represent raw, immutable color values (HSL) across tonal palettes:
 *      Neutral, Neutral Variant, Primary (Blue), Secondary (Teal),
 *      Tertiary (Slate), Error (Red), and Placeholder (Magenta).
 *    - Defined exclusively on `:root` as `--primitive-color-*`.
 *    - RULE: PRIMITIVE COLORS MUST NEVER BE APPLIED DIRECTLY TO UI COMPONENTS.
 *
 * 2. TIER 2: COLOR ROLES (SEMANTIC APPLICATION LAYER)
 *    - Assign semantic purpose and intent to the UI (e.g., surface, on-surface,
 *      primary, on-primary, error, outline, containers).
 *    - Reference primitive variables via `var(--primitive-color-*)`.
 *    - Switch dynamically between Light (`:root`, `[data-theme="light"]`) and
 *      Dark (`[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`).
 *    - RULE: UI COMPONENTS MUST ONLY CONSUME COLOR ROLES.
 *
 * CLI Usage:
 *   node convert-tokens.js
 *   node convert-tokens.js --input ./design-tokens.tokens.json --output ./design-tokens.css
 *   node convert-tokens.js --help
 *
 * @module convert-tokens
 */

const fs = require('fs');
const path = require('path');

/**
 * Registry of primitive color foundations.
 * Maps raw HSL strings from the design tokens to structured foundational palette tokens.
 *
 * @type {Record<string, { name: string, palette: string, label: string, tone?: number }>}
 */
const PRIMITIVE_DEFINITIONS = {
  // Neutral Tonal Palette (Achromatic foundations for backgrounds, surfaces, and text)
  'hsl(0, 0%, 100%)': {
    name: 'primitive-color-neutral-100',
    palette: 'neutral',
    label: 'Neutral 100 (Pure White)',
    tone: 100
  },
  'hsl(0, 0%, 98%)': {
    name: 'primitive-color-neutral-98',
    palette: 'neutral',
    label: 'Neutral 98 (Off-White / Light Canvas)',
    tone: 98
  },
  'hsl(0, 0%, 99%)': {
    name: 'primitive-color-neutral-99',
    palette: 'neutral',
    label: 'Neutral 99 (Near-White Notice Surface)',
    tone: 99
  },
  'hsl(0, 0%, 95%)': {
    name: 'primitive-color-neutral-95',
    palette: 'neutral',
    label: 'Neutral 95 (Soft Gray / Container Low)',
    tone: 95
  },
  'hsl(0, 0%, 93%)': {
    name: 'primitive-color-neutral-93',
    palette: 'neutral',
    label: 'Neutral 93 (Light Surface Container)',
    tone: 93
  },
  'hsl(0, 0%, 91%)': {
    name: 'primitive-color-neutral-91',
    palette: 'neutral',
    label: 'Neutral 91 (Surface Container High)',
    tone: 91
  },
  'hsl(0, 0%, 89%)': {
    name: 'primitive-color-neutral-89',
    palette: 'neutral',
    label: 'Neutral 89 (Surface Container Highest / Dark Text Foundation)',
    tone: 89
  },
  'hsl(0, 0%, 85%)': {
    name: 'primitive-color-neutral-85',
    palette: 'neutral',
    label: 'Neutral 85 (Surface Dim Light)',
    tone: 85
  },
  'hsl(0, 0%, 19%)': {
    name: 'primitive-color-neutral-19',
    palette: 'neutral',
    label: 'Neutral 19 (Dark Charcoal / Inverse Surface)',
    tone: 19
  },
  'hsl(0, 0%, 11%)': {
    name: 'primitive-color-neutral-11',
    palette: 'neutral',
    label: 'Neutral 11 (Near Black / High Contrast Body Text)',
    tone: 11
  },

  // Neutral Variant Tonal Palette (Purple-tinted grays for outlines and decorative surfaces)
  'hsl(276, 19%, 90%)': {
    name: 'primitive-color-neutral-variant-90',
    palette: 'neutral-variant',
    label: 'Neutral Variant 90 (Light Surface Variant)',
    tone: 90
  },
  'hsl(273, 8%, 79%)': {
    name: 'primitive-color-neutral-variant-80',
    palette: 'neutral-variant',
    label: 'Neutral Variant 80 (Outline Variant Light / Dark Low Text)',
    tone: 80
  },
  'hsl(267, 4%, 58%)': {
    name: 'primitive-color-neutral-variant-60',
    palette: 'neutral-variant',
    label: 'Neutral Variant 60 (Dark Mode Outline)',
    tone: 60
  },
  'hsl(262, 3%, 48%)': {
    name: 'primitive-color-neutral-variant-50',
    palette: 'neutral-variant',
    label: 'Neutral Variant 50 (Light Mode Outline)',
    tone: 50
  },
  'hsl(257, 5%, 29%)': {
    name: 'primitive-color-neutral-variant-30',
    palette: 'neutral-variant',
    label: 'Neutral Variant 30 (Dark Surface Variant / Outline Variant)',
    tone: 30
  },

  // Primary Tonal Palette (Brand Blue / Key Interactive Accents)
  'hsl(230, 100%, 93%)': {
    name: 'primitive-color-primary-93',
    palette: 'primary',
    label: 'Primary 93 (Light Primary Container / Dark On-Primary-Container)',
    tone: 93
  },
  'hsl(226, 100%, 85%)': {
    name: 'primitive-color-primary-85',
    palette: 'primary',
    label: 'Primary 85 (Light Inverse Primary)',
    tone: 85
  },
  'hsl(221, 85%, 55%)': {
    name: 'primitive-color-primary-55',
    palette: 'primary',
    label: 'Primary 55 (Main Brand Royal Blue)',
    tone: 55
  },
  'hsl(217, 100%, 43%)': {
    name: 'primitive-color-primary-43',
    palette: 'primary',
    label: 'Primary 43 (Dark Inverse Primary)',
    tone: 43
  },
  'hsl(218, 100%, 33%)': {
    name: 'primitive-color-primary-33',
    palette: 'primary',
    label: 'Primary 33 (Light On-Primary-Container / Dark Primary Container)',
    tone: 33
  },
  'hsl(219, 100%, 23%)': {
    name: 'primitive-color-primary-23',
    palette: 'primary',
    label: 'Primary 23 (Deep Navy / Dark On-Primary)',
    tone: 23
  },

  // Secondary Tonal Palette (Teal / Complementary Actions)
  'hsl(171, 91%, 71%)': {
    name: 'primitive-color-secondary-71',
    palette: 'secondary',
    label: 'Secondary 71 (Light Secondary Container / Dark On-Secondary-Container)',
    tone: 71
  },
  'hsl(171, 66%, 58%)': {
    name: 'primitive-color-secondary-58',
    palette: 'secondary',
    label: 'Secondary 58 (Medium Teal / Dark Secondary Accent)',
    tone: 58
  },
  'hsl(173, 100%, 21%)': {
    name: 'primitive-color-secondary-21',
    palette: 'secondary',
    label: 'Secondary 21 (Deep Pine Teal / Light Secondary Accent)',
    tone: 21
  },
  'hsl(173, 100%, 16%)': {
    name: 'primitive-color-secondary-16',
    palette: 'secondary',
    label: 'Secondary 16 (Light On-Secondary-Container / Dark Secondary Container)',
    tone: 16
  },
  'hsl(173, 100%, 11%)': {
    name: 'primitive-color-secondary-11',
    palette: 'secondary',
    label: 'Secondary 11 (Dark On-Secondary Text)',
    tone: 11
  },

  // Tertiary Tonal Palette (Slate Blue / Subtle Neutralized Accents)
  'hsl(226, 100%, 93%)': {
    name: 'primitive-color-tertiary-93',
    palette: 'tertiary',
    label: 'Tertiary 93 (Light Tertiary Container / Dark On-Tertiary-Container)',
    tone: 93
  },
  'hsl(223, 100%, 84%)': {
    name: 'primitive-color-tertiary-84',
    palette: 'tertiary',
    label: 'Tertiary 84 (Soft Periwinkle / Dark Tertiary Accent)',
    tone: 84
  },
  'hsl(221, 45%, 43%)': {
    name: 'primitive-color-tertiary-43',
    palette: 'tertiary',
    label: 'Tertiary 43 (Slate Denim / Light Tertiary Accent)',
    tone: 43
  },
  'hsl(220, 60%, 33%)': {
    name: 'primitive-color-tertiary-33',
    palette: 'tertiary',
    label: 'Tertiary 33 (Light On-Tertiary-Container / Dark Tertiary Container)',
    tone: 33
  },
  'hsl(215, 100%, 21%)': {
    name: 'primitive-color-tertiary-21',
    palette: 'tertiary',
    label: 'Tertiary 21 (Dark On-Tertiary Text)',
    tone: 21
  },

  // Error Tonal Palette (Red / Destructive & Alert Statuses)
  'hsl(7, 100%, 95%)': {
    name: 'primitive-color-error-95',
    palette: 'error',
    label: 'Error 95 (Light Error Container)',
    tone: 95
  },
  'hsl(359, 100%, 38%)': {
    name: 'primitive-color-error-38',
    palette: 'error',
    label: 'Error 38 (Vibrant Crimson / Light Error Accent)',
    tone: 38
  },
  'hsl(359, 100%, 29%)': {
    name: 'primitive-color-error-29',
    palette: 'error',
    label: 'Error 29 (Deep Maroon / Light On-Error-Container)',
    tone: 29
  },

  // Unresolved Placeholder Token (Magenta)
  // Per .agents/rules/design-system-rule.md, this token indicates dark mode tokens awaiting design approval
  'hsl(300, 100%, 50%)': {
    name: 'primitive-color-magenta-unresolved',
    palette: 'unresolved',
    label: 'Unresolved Magenta Placeholder (Blocked per design-system-rule.md)',
    tone: 50
  }
};

/**
 * Parses HSL color string into numeric components {h, s, l}.
 *
 * @param {string} hslStr - HSL string, e.g. "hsl(221, 85%, 55%)"
 * @returns {{ h: number, s: number, l: number } | null}
 */
function parseHsl(hslStr) {
  const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return null;
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10)
  };
}

/**
 * Resolves primitive metadata for a given HSL string.
 *
 * @param {string} hslValue - The raw HSL color value.
 * @returns {{ name: string, variable: string, value: string, palette: string, label: string, tone?: number }}
 */
function getPrimitiveMetadata(hslValue) {
  const def = PRIMITIVE_DEFINITIONS[hslValue];
  if (def) {
    return {
      name: def.name,
      variable: `--${def.name}`,
      value: hslValue,
      palette: def.palette,
      label: def.label,
      tone: def.tone
    };
  }

  // Fallback for any newly introduced HSL values
  const parsed = parseHsl(hslValue);
  const fallbackTone = parsed ? parsed.l : 'unknown';
  const fallbackHue = parsed ? parsed.h : 'val';
  const fallbackName = `primitive-color-custom-h${fallbackHue}-l${fallbackTone}`;
  return {
    name: fallbackName,
    variable: `--${fallbackName}`,
    value: hslValue,
    palette: 'custom',
    label: `Custom Foundation (${hslValue})`,
    tone: parsed ? parsed.l : undefined
  };
}

/**
 * Normalizes an arbitrary string identifier to kebab-case for CSS property naming.
 *
 * @param {string} str - Raw token identifier.
 * @returns {string} - Clean kebab-case string.
 */
function toKebabCase(str) {
  return str
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\./g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Converts a Figma effect custom-shadow object into standard CSS box-shadow syntax.
 *
 * @param {{ offsetX: number, offsetY: number, radius: number, spread: number, color: string }} val
 * @returns {string} - Valid CSS box-shadow value, e.g. "2px 4px 8px 0px #00000052"
 */
function convertFigmaShadowToCss(val) {
  const x = `${val.offsetX || 0}px`;
  const y = `${val.offsetY || 0}px`;
  const blur = `${val.radius || 0}px`;
  const spread = `${val.spread || 0}px`;
  const color = val.color || 'rgba(0, 0, 0, 0.25)';
  return `${x} ${y} ${blur} ${spread} ${color}`;
}

/**
 * Formats a typography font-family value with proper quotes and fallback stack.
 *
 * @param {string} fontFamily
 * @returns {string}
 */
function formatFontFamily(fontFamily) {
  if (fontFamily.toLowerCase() === 'inter') {
    return `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  }
  if (fontFamily.toLowerCase() === 'roboto') {
    return `"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
  }
  if (fontFamily.toLowerCase().includes('sans')) {
    return `"${fontFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  }
  if (fontFamily.toLowerCase().includes('display') || fontFamily.toLowerCase().includes('serif')) {
    return `"${fontFamily}", Georgia, "Times New Roman", serif`;
  }
  if (fontFamily.toLowerCase().includes('mono')) {
    return `"${fontFamily}", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace`;
  }
  return `"${fontFamily}", sans-serif`;
}

/**
 * Generates the complete, production-ready CSS custom properties stylesheet.
 *
 * @param {object} tokens - The parsed JSON design tokens object.
 * @param {object} [options={}] - Optional configuration flags.
 * @returns {string} - Formatted CSS content.
 */
function generateCss(tokens, options = {}) {
  const lines = [];

  // 1. Collect all unique primitive colors across light and dark
  const uniquePrimitives = new Map();
  const lightColors = tokens.color?.light || {};
  const darkColors = tokens.color?.dark || {};

  for (const [role, hsl] of Object.entries(lightColors)) {
    const meta = getPrimitiveMetadata(hsl);
    if (!uniquePrimitives.has(hsl)) {
      uniquePrimitives.set(hsl, { ...meta, usedIn: [] });
    }
    uniquePrimitives.get(hsl).usedIn.push(`light:${role}`);
  }

  for (const [role, hsl] of Object.entries(darkColors)) {
    const meta = getPrimitiveMetadata(hsl);
    if (!uniquePrimitives.has(hsl)) {
      uniquePrimitives.set(hsl, { ...meta, usedIn: [] });
    }
    uniquePrimitives.get(hsl).usedIn.push(`dark:${role}`);
  }

  // File Header
  lines.push('/**');
  lines.push(' * ==============================================================================');
  lines.push(' * ROTA DESIGN SYSTEM - CSS CUSTOM PROPERTIES (DESIGN TOKENS)');
  lines.push(' * ==============================================================================');
  lines.push(' *');
  lines.push(' * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY.');
  lines.push(' * Generated by: `node convert-tokens.js`');
  lines.push(' * Source: `design-tokens.tokens.json`');
  lines.push(' *');
  lines.push(' * ------------------------------------------------------------------------------');
  lines.push(' * CRITICAL ARCHITECTURAL DISTINCTION: PRIMITIVES VS COLOR ROLES');
  lines.push(' * ------------------------------------------------------------------------------');
  lines.push(' * 1. TIER 1: PRIMITIVE COLORS (--primitive-color-*)');
  lines.push(' *    - Raw palette foundations (Neutral, Primary, Secondary, Tertiary, Error).');
  lines.push(' *    - Defined on `:root` as the unchanging foundation.');
  lines.push(' *    - [!] WARNING: DO NOT APPLY DIRECTLY TO UI COMPONENTS.');
  lines.push(' *');
  lines.push(' * 2. TIER 2: COLOR ROLES (--primary-color, --surface-color, etc.)');
  lines.push(' *    - Semantic colors assigned to specific UI elements and intents.');
  lines.push(' *    - Point to primitives via `var(--primitive-color-*)`.');
  lines.push(' *    - Dynamically switch values between Light and Dark themes.');
  lines.push(' *    - [✓] RULE: ALWAYS USE THESE COLOR ROLES IN COMPONENT STYLES.');
  lines.push(' * ==============================================================================');
  lines.push(' */');
  lines.push('');

  // ===========================================================================
  // :root Scope - Primitives, Light Roles, Typography, Spacing, Radius, Shadows
  // ===========================================================================
  lines.push(':root {');

  // --- TIER 1: PRIMITIVE COLORS ---
  lines.push('  /* ==========================================================================');
  lines.push('     TIER 1: PRIMITIVE COLORS (FOUNDATION PALETTES)');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     DO NOT APPLY DIRECTLY ON UI COMPONENTS!');
  lines.push('     These tokens serve as the underlying foundations. UI components must only');
  lines.push('     consume the semantic COLOR ROLES (Tier 2) below.');
  lines.push('     ========================================================================== */');

  // Group primitives by palette for clarity
  const paletteGroups = {
    'neutral': 'Neutral Palette (Achromatic Foundations)',
    'neutral-variant': 'Neutral Variant Palette (Purple/Violet-tinted Grays)',
    'primary': 'Primary Palette (Brand Blue Foundations)',
    'secondary': 'Secondary Palette (Teal Foundations)',
    'tertiary': 'Tertiary Palette (Slate Blue Foundations)',
    'error': 'Error Palette (Crimson & Red Foundations)',
    'unresolved': 'Unresolved Placeholder (Blocked per design-system-rule.md)'
  };

  const primitivesList = Array.from(uniquePrimitives.values());

  for (const [paletteKey, groupTitle] of Object.entries(paletteGroups)) {
    const groupItems = primitivesList.filter(p => p.palette === paletteKey);
    if (groupItems.length === 0) continue;

    // Sort by tone descending (100 down to 0)
    groupItems.sort((a, b) => (b.tone ?? 0) - (a.tone ?? 0));

    lines.push('');
    lines.push(`  /* --- ${groupTitle} --- */`);
    for (const item of groupItems) {
      lines.push(`  ${item.variable}: ${item.value}; /* ${item.label} */`);
    }
  }

  // --- TIER 2: COLOR ROLES (LIGHT THEME DEFAULT) ---
  lines.push('');
  lines.push('  /* ==========================================================================');
  lines.push('     TIER 2: COLOR ROLES (LIGHT THEME - DEFAULT)');
  lines.push('     --------------------------------------------------------------------------');
  lines.push('     APPLY THESE ON UI COMPONENTS!');
  lines.push('     Use these semantic variables for backgrounds, borders, text, and icons.');
  lines.push('     ========================================================================== */');

  for (const [role, hsl] of Object.entries(lightColors)) {
    const meta = getPrimitiveMetadata(hsl);
    const varName = `--${role}`;
    const aliasName = `--color-${role.replace(/-color$/, '')}`;
    lines.push(`  ${varName}: var(${meta.variable}); /* ${hsl} -> ${meta.label} */`);
    if (aliasName !== varName) {
      lines.push(`  ${aliasName}: var(${varName});`);
    }
  }

  // --- TYPOGRAPHY TOKENS ---
  if (tokens.typography) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     TYPOGRAPHY TOKENS');
    lines.push('     ========================================================================== */');

    const isComposite = Object.values(tokens.typography).some(
      (v) => typeof v === 'object' && v !== null && (v.fontSize || v.fontFamily)
    );

    if (isComposite) {
      lines.push('  /* Foundational Font Families */');
      lines.push('  --font-family-display: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
      lines.push('  --font-family-headline: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
      lines.push('  --font-family-title-large: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
      lines.push('  --font-family-body: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;');
      lines.push('  --font-family-label: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;');
      lines.push('');

      for (const [roleName, styleObj] of Object.entries(tokens.typography)) {
        if (typeof styleObj !== 'object' || styleObj === null) continue;
        const roleKey = roleName.toLowerCase().replace(/[()]/g, '').trim().replace(/\s+/g, '-');
        const fontSizePx = styleObj.fontSize ? styleObj.fontSize.value : 16;
        const fontFamily = styleObj.fontFamily ? styleObj.fontFamily.value : 'Roboto';
        const fontWeight = styleObj.fontWeight ? styleObj.fontWeight.value : 400;
        const lineHeightPx = styleObj.lineHeight ? styleObj.lineHeight.value : fontSizePx * 1.4;
        const letterSpacingPx = styleObj.letterSpacing ? styleObj.letterSpacing.value : 0;
        const textDecoration = styleObj.textDecoration ? styleObj.textDecoration.value : 'none';
        const fontStyle = styleObj.fontStyle ? styleObj.fontStyle.value : 'normal';

        const familyStack = formatFontFamily(fontFamily);
        const fontSizeRem = `${Number((fontSizePx / 16).toFixed(4))}rem`;

        lines.push(`  /* ${roleName.toUpperCase()} (${fontFamily} ${fontWeight}, ${fontSizePx}px) */`);
        lines.push(`  --typography-${roleKey}-font-family: ${familyStack};`);
        lines.push(`  --typography-${roleKey}-font-size: ${fontSizePx}px;`);
        lines.push(`  --typography-${roleKey}-font-size-rem: ${fontSizeRem};`);
        lines.push(`  --typography-${roleKey}-font-weight: ${fontWeight};`);
        lines.push(`  --typography-${roleKey}-line-height: ${lineHeightPx}px;`);
        lines.push(`  --typography-${roleKey}-line-height-ratio: ${Number((lineHeightPx / fontSizePx).toFixed(4))};`);
        lines.push(`  --typography-${roleKey}-letter-spacing: ${letterSpacingPx}px;`);
        lines.push(`  --typography-${roleKey}-text-decoration: ${textDecoration};`);
        lines.push(`  --typography-${roleKey}-font-style: ${fontStyle};`);
        lines.push(`  --typography-${roleKey}: ${fontStyle} ${fontWeight} ${fontSizePx}px/${lineHeightPx}px ${familyStack};`);
        lines.push('');
      }
    } else {
      // Font Families
      lines.push('  /* Font Families */');
      for (const [k, v] of Object.entries(tokens.typography)) {
        if (k.startsWith('font-family')) {
          lines.push(`  --${k}: ${formatFontFamily(v)};`);
        }
      }

      // Font Sizes
      lines.push('');
      lines.push('  /* Font Sizes */');
      for (const [k, v] of Object.entries(tokens.typography)) {
        if (k.startsWith('font-size')) {
          lines.push(`  --${k}: ${v};`);
        }
      }

      // Font Weights
      lines.push('');
      lines.push('  /* Font Weights */');
      for (const [k, v] of Object.entries(tokens.typography)) {
        if (k.startsWith('font-weight')) {
          lines.push(`  --${k}: ${v};`);
        }
      }

      // Line Heights
      lines.push('');
      lines.push('  /* Line Heights */');
      for (const [k, v] of Object.entries(tokens.typography)) {
        if (k.startsWith('line-height')) {
          lines.push(`  --${k}: ${v};`);
        }
      }

      // Letter Spacing
      lines.push('');
      lines.push('  /* Letter Spacing */');
      for (const [k, v] of Object.entries(tokens.typography)) {
        if (k.startsWith('letter-spacing')) {
          lines.push(`  --${k}: ${v};`);
        }
      }
    }
  }

  // --- SPACING TOKENS (STANDARD REM SCALE) ---
  if (tokens.spacing) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     SPACING TOKENS (STANDARD REM SCALE)');
    lines.push('     ========================================================================== */');
    for (const [k, v] of Object.entries(tokens.spacing)) {
      const sanitizedKey = k.replace(/\./g, '-');
      lines.push(`  --${sanitizedKey}: ${v};`);
      // Provide escape alias if decimal was present
      if (k.includes('.')) {
        lines.push(`  --${k.replace(/\./g, '\\.')}: var(--${sanitizedKey});`);
      }
    }
  }

  // --- SPACING COLLECTION (FIGMA 8PT/DIMENSION SCALE) ---
  if (tokens['spacing collection']) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     SPACING COLLECTION (FIGMA DIMENSION / PIXEL SCALE)');
    lines.push('     ========================================================================== */');
    for (const [k, obj] of Object.entries(tokens['spacing collection'])) {
      const pxVal = typeof obj.value === 'number' ? `${obj.value}px` : obj.value;
      const kebab = toKebabCase(k);
      lines.push(`  --${kebab}: ${pxVal};`);

      // Shorthand for base token, e.g. --space-100 for --space-100-base
      if (kebab === 'space-100-base') {
        lines.push(`  --space-100: var(--space-100-base);`);
      }
    }
  }

  // --- BORDER RADIUS TOKENS ---
  if (tokens.borderRadius) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     BORDER RADIUS TOKENS');
    lines.push('     ========================================================================== */');
    for (const [k, v] of Object.entries(tokens.borderRadius)) {
      lines.push(`  --${k}: ${v};`);
      const alias = `--border-${k}`;
      lines.push(`  ${alias}: var(--${k});`);
    }
  }

  // --- SHADOW TOKENS ---
  if (tokens.shadows) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     SHADOW TOKENS');
    lines.push('     ========================================================================== */');
    for (const [k, v] of Object.entries(tokens.shadows)) {
      lines.push(`  --${k}: ${v};`);
    }
  }

  // --- ELEVATION TOKENS ---
  if (tokens.elevation) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     ELEVATION TOKENS');
    lines.push('     ========================================================================== */');
    for (const [k, v] of Object.entries(tokens.elevation)) {
      lines.push(`  --${k}: ${v};`);
    }
  }

  // --- EFFECT SHADOWS (FIGMA DROP SHADOWS) ---
  if (tokens.effect) {
    lines.push('');
    lines.push('  /* ==========================================================================');
    lines.push('     EFFECT SHADOWS (FIGMA DROP SHADOW CONVERSION)');
    lines.push('     ========================================================================== */');
    for (const [k, obj] of Object.entries(tokens.effect)) {
      const cssVal = convertFigmaShadowToCss(obj.value);
      const kebab = toKebabCase(k);
      lines.push(`  --effect-${kebab}: ${cssVal};`);
    }
  }

  lines.push('}');
  lines.push('');

  // ===========================================================================
  // Light Theme Explicit Selector [data-theme="light"]
  // ===========================================================================
  lines.push('/**');
  lines.push(' * Explicit Light Theme Attribute Selector');
  lines.push(' */');
  lines.push('[data-theme="light"] {');
  for (const [role, hsl] of Object.entries(lightColors)) {
    const meta = getPrimitiveMetadata(hsl);
    lines.push(`  --${role}: var(${meta.variable});`);
    const aliasName = `--color-${role.replace(/-color$/, '')}`;
    if (aliasName !== `--${role}`) {
      lines.push(`  ${aliasName}: var(--${role});`);
    }
  }
  lines.push('}');
  lines.push('');

  // ===========================================================================
  // Dark Theme Scope: [data-theme="dark"]
  // ===========================================================================
  lines.push('/* ==========================================================================');
  lines.push('   TIER 2: COLOR ROLES (DARK THEME - EXPLICIT ATTRIBUTE)');
  lines.push('   --------------------------------------------------------------------------');
  lines.push('   APPLY ON UI COMPONENTS IN DARK MODE.');
  lines.push('   NOTE: The magenta values (hsl(300, 100%, 50%)) represent unresolved tokens');
  lines.push('   awaiting design approval as documented in `.agents/rules/design-system-rule.md`.');
  lines.push('   ========================================================================== */');
  lines.push('[data-theme="dark"] {');

  for (const [role, hsl] of Object.entries(darkColors)) {
    const meta = getPrimitiveMetadata(hsl);
    const unresolvedFlag = hsl === 'hsl(300, 100%, 50%)'
      ? ' /* [UNRESOLVED TOKEN - BLOCKED] */'
      : '';
    lines.push(`  --${role}: var(${meta.variable});${unresolvedFlag}`);
    const aliasName = `--color-${role.replace(/-color$/, '')}`;
    if (aliasName !== `--${role}`) {
      lines.push(`  ${aliasName}: var(--${role});`);
    }
  }
  lines.push('}');
  lines.push('');

  // ===========================================================================
  // System Preference Dark Theme Media Query
  // ===========================================================================
  lines.push('/**');
  lines.push(' * Auto System Dark Theme Preference');
  lines.push(' * Applies dark roles automatically when system prefers dark mode and no');
  lines.push(' * explicit `data-theme="light"` override is set on the document element.');
  lines.push(' */');
  lines.push('@media (prefers-color-scheme: dark) {');
  lines.push('  :root:not([data-theme="light"]) {');
  for (const [role, hsl] of Object.entries(darkColors)) {
    const meta = getPrimitiveMetadata(hsl);
    lines.push(`    --${role}: var(${meta.variable});`);
    const aliasName = `--color-${role.replace(/-color$/, '')}`;
    if (aliasName !== `--${role}`) {
      lines.push(`    ${aliasName}: var(--${role});`);
    }
  }
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main conversion runner function.
 *
 * @param {string} inputPath - Path to JSON design tokens file.
 * @param {string} outputPath - Path to output CSS file.
 * @returns {{ tokenCount: number, primitiveCount: number, roleCount: number, outputPath: string }}
 */
function convertTokens(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found at: ${inputPath}`);
  }

  const rawData = fs.readFileSync(inputPath, 'utf8');
  let tokens;
  try {
    tokens = JSON.parse(rawData);
  } catch (err) {
    throw new Error(`Failed to parse JSON design tokens: ${err.message}`);
  }

  const css = generateCss(tokens);

  // Ensure target directory exists
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, css, 'utf8');

  // Compute stats
  const uniqueHsls = new Set([
    ...Object.values(tokens.color?.light || {}),
    ...Object.values(tokens.color?.dark || {})
  ]);
  const lightRoleCount = Object.keys(tokens.color?.light || {}).length;
  const darkRoleCount = Object.keys(tokens.color?.dark || {}).length;

  return {
    primitiveCount: uniqueHsls.size,
    roleCount: lightRoleCount + darkRoleCount,
    outputPath
  };
}

/**
 * CLI parser and execution handler.
 */
function runCli() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Rota Design Tokens to CSS Converter
====================================
Converts 'design-tokens.tokens.json' into a production-ready CSS variables stylesheet
with a strict 2-tier architecture (Foundational Primitives vs UI Color Roles).

Usage:
  node convert-tokens.js [options]

Options:
  --input, -i   Path to the design tokens JSON file (default: ./design-tokens.tokens.json)
  --output, -o  Path to write the CSS custom properties file (default: ./design-tokens.css)
  --help, -h    Show this help message

Color Architecture Note:
  - Primitive Colors (--primitive-color-*): Foundations only. DO NOT APPLY ON UI.
  - Color Roles (--primary-color, --surface-color): Semantic layer. APPLY ON UI ONLY.
`);
    process.exit(0);
  }

  let inputPath = path.resolve(process.cwd(), 'design-tokens.tokens.json');
  let outputPath = path.resolve(process.cwd(), 'design-tokens.css');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' || args[i] === '-i') {
      inputPath = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--output' || args[i] === '-o') {
      outputPath = path.resolve(process.cwd(), args[++i]);
    }
  }

  try {
    console.log(`[convert-tokens] Reading design tokens from: ${inputPath}`);
    const result = convertTokens(inputPath, outputPath);
    console.log(`[convert-tokens] ✓ Successfully generated CSS custom properties!`);
    console.log(`[convert-tokens]   Output: ${result.outputPath}`);
    console.log(`[convert-tokens]   Primitive Colors (Foundations): ${result.primitiveCount}`);
    console.log(`[convert-tokens]   Color Roles (UI Application Layer): ${result.roleCount / 2} roles (Light & Dark)`);
  } catch (error) {
    console.error(`[convert-tokens] ✗ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run CLI when executed directly
if (require.main === module) {
  runCli();
}

module.exports = {
  convertTokens,
  generateCss,
  getPrimitiveMetadata,
  PRIMITIVE_DEFINITIONS
};
