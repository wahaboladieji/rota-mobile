/**
 * ==============================================================================
 * Rota Design System - Typography & Spacing Tokens to CSS Variables Converter
 * ==============================================================================
 *
 * This script transforms the original Typography and Spacing Collection design
 * tokens (from Figma Design Tokens export) into production-ready CSS variables
 * and utility classes.
 *
 * Typography Architecture:
 * ------------------------
 * 1. Semantic Composite Roles (Display, Headline, Title, Body, Label)
 * 2. Dedicated atomic CSS variables per property (font-family, font-size,
 *    font-weight, line-height, letter-spacing, text-decoration, font-style)
 * 3. Composite font shorthand variables
 * 4. Foundational scales (Font Families, Sizes, Weights, Line Heights)
 * 5. Spacing scale (--space-*) from Spacing Collection
 * 6. Ready-to-use CSS utility classes (.typography-[role])
 *
 * CLI Usage:
 *   node convert-typography-tokens.js
 *   node convert-typography-tokens.js --input ./typography-tokens.tokens.json --output ./typography-tokens.css
 *   node convert-typography-tokens.js --help
 */

const fs = require('fs');
const path = require('path');

// CLI Arguments
const args = process.argv.slice(2);
let inputPath = path.resolve(__dirname, 'typography-tokens.tokens.json');
let outputPath = path.resolve(__dirname, 'typography-tokens.css');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) {
    inputPath = path.resolve(process.cwd(), args[i + 1]);
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputPath = path.resolve(process.cwd(), args[i + 1]);
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: node convert-typography-tokens.js [options]

Options:
  --input <path>   Path to input JSON tokens file (default: ./typography-tokens.tokens.json)
  --output <path>  Path to output CSS file (default: ./typography-tokens.css)
  --help, -h       Display this help message
`);
    process.exit(0);
  }
}

function sanitizeKey(key) {
  return key
    .toLowerCase()
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function formatFontFamily(fontFamily) {
  if (fontFamily.toLowerCase() === 'inter') {
    return '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
  if (fontFamily.toLowerCase() === 'roboto') {
    return '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
  }
  return `"${fontFamily}", sans-serif`;
}

function pxToRem(px, base = 16) {
  const rem = px / base;
  return `${Number(rem.toFixed(4))}rem`;
}

function convertTokensToCSS(tokenData) {
  const lines = [];

  lines.push('/**');
  lines.push(' * Rota Design System - Typography & Spacing CSS Custom Properties');
  lines.push(' * Generated automatically from typography design tokens.');
  lines.push(` * Timestamp: ${new Date().toISOString()}`);
  lines.push(' */');
  lines.push('');
  lines.push(':root {');

  // --- 1. SPACING COLLECTION ---
  const spacingData = tokenData['spacing collection'] || tokenData.spacing;
  if (spacingData) {
    lines.push('  /* ==========================================================================');
    lines.push('     SPACING COLLECTION (8pt Baseline Dimension Scale)');
    lines.push('     ========================================================================== */');

    for (const [key, token] of Object.entries(spacingData)) {
      const sanitized = sanitizeKey(key);
      const val = typeof token === 'object' && token.value !== undefined ? token.value : token;
      lines.push(`  --${sanitized}: ${val}px;`);

      // Add alias for base if applicable
      if (key.includes('base') && !sanitized.endsWith('-base')) {
        lines.push(`  --${sanitized}-base: ${val}px;`);
      }
    }
    lines.push('');
  }

  // --- 2. TYPOGRAPHY SYSTEM ---
  const typographyData = tokenData.typography;
  if (typographyData) {
    lines.push('  /* ==========================================================================');
    lines.push('     TYPOGRAPHY SYSTEM - FOUNDATIONAL FONT FAMILIES');
    lines.push('     ========================================================================== */');
    lines.push('  --font-family-display: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
    lines.push('  --font-family-headline: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
    lines.push('  --font-family-title-large: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
    lines.push('  --font-family-body: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;');
    lines.push('  --font-family-label: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;');
    lines.push('');

    lines.push('  /* ==========================================================================');
    lines.push('     TYPOGRAPHY SYSTEM - SEMANTIC ROLES');
    lines.push('     ========================================================================== */');

    for (const [roleName, styleObj] of Object.entries(typographyData)) {
      const roleKey = sanitizeKey(roleName);
      const fontSizePx = styleObj.fontSize ? styleObj.fontSize.value : 16;
      const fontFamily = styleObj.fontFamily ? styleObj.fontFamily.value : 'Roboto';
      const fontWeight = styleObj.fontWeight ? styleObj.fontWeight.value : 400;
      const lineHeightPx = styleObj.lineHeight ? styleObj.lineHeight.value : fontSizePx * 1.4;
      const letterSpacingPx = styleObj.letterSpacing ? styleObj.letterSpacing.value : 0;
      const textDecoration = styleObj.textDecoration ? styleObj.textDecoration.value : 'none';
      const fontStyle = styleObj.fontStyle ? styleObj.fontStyle.value : 'normal';

      const formattedFamily = formatFontFamily(fontFamily);
      const fontSizeRem = pxToRem(fontSizePx);

      lines.push(`  /* ${roleName.toUpperCase()} (${fontFamily} ${fontWeight}, ${fontSizePx}px / ${fontSizeRem}) */`);
      lines.push(`  --typography-${roleKey}-font-family: ${formattedFamily};`);
      lines.push(`  --typography-${roleKey}-font-size: ${fontSizePx}px;`);
      lines.push(`  --typography-${roleKey}-font-size-rem: ${fontSizeRem};`);
      lines.push(`  --typography-${roleKey}-font-weight: ${fontWeight};`);
      lines.push(`  --typography-${roleKey}-line-height: ${lineHeightPx}px;`);
      lines.push(`  --typography-${roleKey}-line-height-ratio: ${Number((lineHeightPx / fontSizePx).toFixed(4))};`);
      lines.push(`  --typography-${roleKey}-letter-spacing: ${letterSpacingPx}px;`);
      lines.push(`  --typography-${roleKey}-text-decoration: ${textDecoration};`);
      lines.push(`  --typography-${roleKey}-font-style: ${fontStyle};`);
      lines.push(`  --typography-${roleKey}: ${fontStyle} ${fontWeight} ${fontSizePx}px/${lineHeightPx}px ${formattedFamily};`);
      lines.push('');
    }
  }

  lines.push('}');
  lines.push('');

  // --- 3. CSS UTILITY CLASSES ---
  if (typographyData) {
    lines.push('/* ==========================================================================');
    lines.push('   TYPOGRAPHY UTILITY CLASSES');
    lines.push('   ========================================================================== */');
    for (const roleName of Object.keys(typographyData)) {
      const roleKey = sanitizeKey(roleName);
      lines.push(`.${roleKey},`);
      lines.push(`.typography-${roleKey} {`);
      lines.push(`  font-family: var(--typography-${roleKey}-font-family);`);
      lines.push(`  font-size: var(--typography-${roleKey}-font-size);`);
      lines.push(`  font-weight: var(--typography-${roleKey}-font-weight);`);
      lines.push(`  line-height: var(--typography-${roleKey}-line-height);`);
      lines.push(`  letter-spacing: var(--typography-${roleKey}-letter-spacing);`);
      lines.push(`  text-decoration: var(--typography-${roleKey}-text-decoration);`);
      lines.push(`  font-style: var(--typography-${roleKey}-font-style);`);
      lines.push('}');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Execution
try {
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(inputPath, 'utf8');
  const tokenData = JSON.parse(rawJson);
  const cssOutput = convertTokensToCSS(tokenData);

  fs.writeFileSync(outputPath, cssOutput, 'utf8');
  console.log(`Successfully converted typography tokens!`);
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outputPath}`);
} catch (err) {
  console.error('Error converting tokens:', err);
  process.exit(1);
}

module.exports = { convertTokensToCSS };
