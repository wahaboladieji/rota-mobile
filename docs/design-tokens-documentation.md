# Rota Design System: Token Architecture & CSS Variables Documentation

## 1. Executive Summary

This document defines the architecture, conversion pipeline, and consumption standards for the **Rota Design System** tokens. The design tokens originated in `design-tokens.tokens.json` and are compiled into native CSS custom properties (`design-tokens.css`) via the standalone JavaScript utility `convert-tokens.js`.

The primary goal of this token architecture is to establish a **strict, multi-tier abstraction** that decouples foundational design primitives from UI semantic application, ensuring effortless theme switching (Light, Dark, and System preference), airtight accessibility, and scalable component styling.

---

## 2. The 2-Tier Color Architecture

The Rota color system is built upon a fundamental architectural distinction between **Foundational Primitives** and **Semantic Color Roles**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 1: PRIMITIVE COLOR FOUNDATIONS                  │
│                     (--primitive-color-[palette]-[tone])               │
│                                                                        │
│   • Neutral Palette          • Primary Palette (Blue)                  │
│   • Neutral Variant Palette  • Secondary Palette (Teal)                │
│   • Error Palette (Red)      • Tertiary Palette (Slate)                │
│                                                                        │
│   [!] RULE: IMMUTABLE BASE VALUES. NEVER APPLY DIRECTLY TO UI.         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                       Referenced by var() aliases
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    TIER 2: SEMANTIC COLOR ROLES                        │
│                 (--[role]-color / --color-[role])                      │
│                                                                        │
│   • Surface & Background      • Primary & On-Primary                   │
│   • Containers & On-Container • Secondary & On-Secondary               │
│   • Outline & Outline Variant • Error & On-Error                       │
│                                                                        │
│   [✓] RULE: UI APPLICATION LAYER. USE EXCLUSIVELY ON COMPONENTS.       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               Switches dynamically based on active theme
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [ Light Theme: :root ]             [ Dark Theme: [data-theme="dark"] ]
      --surface-color: Neutral 98        --surface-color: Neutral / Unresolved
      --on-surface-color: Neutral 11     --on-surface-color: Neutral 89
```

---

### Tier 1: Primitive Colors (Foundational Palette)

Primitive colors represent raw, physical color values expressed in standard `hsl(...)` notation. They are organized into tonal palettes:
- **Neutral**: Achromatic grays ranging from tone 100 (pure white) down to tone 11 (near black).
- **Neutral Variant**: Purple-tinted grays utilized for subtle surface differentiation and structural outlines.
- **Primary**: Brand royal blues (tones 93, 85, 55, 43, 33, 23).
- **Secondary**: Deep pine teal to vibrant cyan-teals (tones 71, 58, 21, 16, 11).
- **Tertiary**: Slate and periwinkle blues (tones 93, 84, 43, 33, 21).
- **Error**: Red and crimson alarms (tones 95, 38, 29).
- **Unresolved Placeholder**: High-visibility magenta (`hsl(300, 100%, 50%)`) indicating tokens awaiting design approval.

> [!WARNING]
> ### Architectural Rule: Primitives Must Never Be Applied Directly to UI
> **Primitive color variables (`--primitive-color-*`) must NEVER be used directly in component styles or markup.**
>
> **Why?**
> 1. **Breaks Theme Inversion**: If a developer writes `background-color: var(--primitive-color-neutral-98)` on a card, that card will remain blazing white even when the user switches to Dark Mode.
> 2. **Destroys Semantic Meaning**: A raw color code does not communicate *intent*. It doesn't answer whether the color is a background, an interactive element, or a border.
> 3. **Bypasses Accessibility & Contrast Guarantees**: Color roles are designed in accessible foreground/background pairs (e.g., `surface` + `on-surface`). Bypassing the role breaks contrast pairings.

---

### Tier 2: Color Roles (UI Application Layer)

Color roles assign **semantic purpose and intent** to UI elements. They are the **only colors permitted in UI styling**.

Color roles are mapped to primitives using `var(--primitive-color-*)` and automatically update their targets based on the active theme:

| Semantic Role | UI Intent & Usage | Paired Foreground Role |
| :--- | :--- | :--- |
| `--primary-color` | High-emphasis interactive elements, primary action buttons, active indicators | `--on-primary-color` |
| `--primary-container-color` | Lower-prominence primary containers, active pill badges, selected states | `--on-primary-container-color` |
| `--secondary-color` | Complementary interactive elements, secondary actions, filter chips | `--on-secondary-color` |
| `--secondary-container-color` | Secondary badge containers, subtle highlight chips | `--on-secondary-container-color` |
| `--tertiary-color` | Subtle accents, balance elements, tertiary metadata tags | `--on-tertiary-color` |
| `--tertiary-container-color` | Background for tertiary chips, informational banners | `--on-tertiary-container-color` |
| `--error-color` | High-urgency alert states, destructive button backgrounds, critical icons | `--on-error-color` |
| `--error-container-color` | Background for error callouts, alert banners, warning toasts | `--on-error-container-color` |
| `--background-color` | Canvas background behind all scrollable screen content | `--on-background-color` |
| `--surface-color` | Surfaces of cards, sheets, dialogs, and navigation bars | `--on-surface-color` |
| `--surface-variant-color` | Distinct variant surfaces (e.g., table headers, card headers) | `--on-surface-variant-color` |
| `--surface-container-lowest-color` | Lowest elevation container (often pure white in light mode) | `--on-surface-color` |
| `--surface-container-low-color` | Low elevation card surface | `--on-surface-color` |
| `--surface-container-color` | Standard container background | `--on-surface-color` |
| `--surface-container-high-color` | Higher elevation container, floating cards | `--on-surface-color` |
| `--surface-container-highest-color`| Highest container elevation before floating modals | `--on-surface-color` |
| `--outline-color` | High-contrast structural boundaries, input borders, dividers | N/A (Border) |
| `--outline-variant-color` | Subtle inner dividers, disabled borders, decorative lines | N/A (Border) |
| `--inverse-surface-color` | Inverted surface for temporary notifications (e.g., snackbars/toasts)| `--inverse-on-surface-color` |
| `--inverse-primary-color` | Inverted primary action within an inverse surface | N/A |

---

## 3. Dark Theme & Unresolved Magenta Tokens

Per `.agents/rules/design-system-rule.md`, the supplied design tokens in `design-tokens.tokens.json` contain placeholder values (`hsl(300, 100%, 50%)` / vibrant magenta) for certain dark mode tokens:

- `error-color`, `on-error-color`, `error-container-color`, `on-error-container-color`
- `background-color`, `surface-color`, `surface-dim-color`, `surface-bright-color`
- `surface-container-lowest-color`, `surface-container-color`, `surface-container-high-color`, `surface-container-highest-color`

> [!IMPORTANT]
> ### Dark Theme Status: Pending Design Owner Decision
> As recorded in `design-system-rule.md`:
> 1. `error-color` and `on-error-color` in dark mode are currently identical (`hsl(300, 100%, 50%)`), which fails contrast standards.
> 2. The script converts these faithfully to `--primitive-color-magenta-unresolved` and annotates them as `/* [UNRESOLVED TOKEN - BLOCKED] */`.
> 3. Developers **MUST NOT** invent replacement colors in UI code.
> 4. Dark theme acceptance remains blocked until the design owner supplies approved dark values.

---

## 4. Complete Design Token Catalog

### 4.1. Primitive Colors (Tier 1 Foundations)

These tokens are defined at `:root` and provide the foundation for all roles:

| Category | Token Variable | HSL Value | Description |
| :--- | :--- | :--- | :--- |
| **Neutral** | `--primitive-color-neutral-100` | `hsl(0, 0%, 100%)` | Pure White |
| **Neutral** | `--primitive-color-neutral-98` | `hsl(0, 0%, 98%)` | Off-White / Canvas |
| **Neutral** | `--primitive-color-neutral-95` | `hsl(0, 0%, 95%)` | Soft Gray / Low Container |
| **Neutral** | `--primitive-color-neutral-93` | `hsl(0, 0%, 93%)` | Surface Container |
| **Neutral** | `--primitive-color-neutral-91` | `hsl(0, 0%, 91%)` | Surface Container High |
| **Neutral** | `--primitive-color-neutral-89` | `hsl(0, 0%, 89%)` | Dark Text Foundation / Highest Container |
| **Neutral** | `--primitive-color-neutral-85` | `hsl(0, 0%, 85%)` | Surface Dim |
| **Neutral** | `--primitive-color-neutral-19` | `hsl(0, 0%, 19%)` | Dark Charcoal / Inverse Surface |
| **Neutral** | `--primitive-color-neutral-11` | `hsl(0, 0%, 11%)` | Near Black / Body Text |
| **Neutral Variant** | `--primitive-color-neutral-variant-90` | `hsl(276, 19%, 90%)` | Light Surface Variant |
| **Neutral Variant** | `--primitive-color-neutral-variant-80` | `hsl(273, 8%, 79%)` | Outline Variant Light |
| **Neutral Variant** | `--primitive-color-neutral-variant-60` | `hsl(267, 4%, 58%)` | Dark Mode Outline |
| **Neutral Variant** | `--primitive-color-neutral-variant-50` | `hsl(262, 3%, 48%)` | Light Mode Outline |
| **Neutral Variant** | `--primitive-color-neutral-variant-30` | `hsl(257, 5%, 29%)` | Dark Surface Variant |
| **Primary** | `--primitive-color-primary-93` | `hsl(230, 100%, 93%)` | Light Primary Container |
| **Primary** | `--primitive-color-primary-85` | `hsl(226, 100%, 85%)` | Light Inverse Primary |
| **Primary** | `--primitive-color-primary-55` | `hsl(221, 85%, 55%)` | Royal Blue Brand Core |
| **Primary** | `--primitive-color-primary-43` | `hsl(217, 100%, 43%)` | Dark Inverse Primary |
| **Primary** | `--primitive-color-primary-33` | `hsl(218, 100%, 33%)` | Deep Blue Container |
| **Primary** | `--primitive-color-primary-23` | `hsl(219, 100%, 23%)` | Deep Navy On-Primary |
| **Secondary** | `--primitive-color-secondary-71` | `hsl(171, 91%, 71%)` | Light Secondary Container |
| **Secondary** | `--primitive-color-secondary-58` | `hsl(171, 66%, 58%)` | Medium Teal Accent |
| **Secondary** | `--primitive-color-secondary-21` | `hsl(173, 100%, 21%)` | Deep Pine Teal Accent |
| **Secondary** | `--primitive-color-secondary-16` | `hsl(173, 100%, 16%)` | Dark Secondary Container |
| **Secondary** | `--primitive-color-secondary-11` | `hsl(173, 100%, 11%)` | Dark On-Secondary Text |
| **Tertiary** | `--primitive-color-tertiary-93` | `hsl(226, 100%, 93%)` | Light Tertiary Container |
| **Tertiary** | `--primitive-color-tertiary-84` | `hsl(223, 100%, 84%)` | Soft Periwinkle Accent |
| **Tertiary** | `--primitive-color-tertiary-43` | `hsl(221, 45%, 43%)` | Slate Denim Accent |
| **Tertiary** | `--primitive-color-tertiary-33` | `hsl(220, 60%, 33%)` | Dark Tertiary Container |
| **Tertiary** | `--primitive-color-tertiary-21` | `hsl(215, 100%, 21%)` | Dark On-Tertiary Text |
| **Error** | `--primitive-color-error-95` | `hsl(7, 100%, 95%)` | Light Error Container |
| **Error** | `--primitive-color-error-38` | `hsl(359, 100%, 38%)` | Vibrant Crimson |
| **Error** | `--primitive-color-error-29` | `hsl(359, 100%, 29%)` | Deep Maroon On-Container |
| **Unresolved** | `--primitive-color-magenta-unresolved` | `hsl(300, 100%, 50%)` | Unresolved Placeholder |

---

### 4.2. Color Roles (Tier 2 Semantic UI Layer)

Both direct names (`--primary-color`) and standard aliases (`--color-primary`) are generated:

| Role Name | Light Mode Primitive | Dark Mode Primitive | Status |
| :--- | :--- | :--- | :--- |
| `--primary-color` | `--primitive-color-primary-55` | `--primitive-color-primary-55` | Ready |
| `--on-primary-color` | `--primitive-color-neutral-100` | `--primitive-color-primary-23` | Ready |
| `--primary-container-color` | `--primitive-color-primary-93` | `--primitive-color-primary-33` | Ready |
| `--on-primary-container-color` | `--primitive-color-primary-33` | `--primitive-color-primary-93` | Ready |
| `--secondary-color` | `--primitive-color-secondary-21` | `--primitive-color-secondary-58` | Ready |
| `--on-secondary-color` | `--primitive-color-neutral-100` | `--primitive-color-secondary-11` | Ready |
| `--secondary-container-color` | `--primitive-color-secondary-71` | `--primitive-color-secondary-16` | Ready |
| `--on-secondary-container-color` | `--primitive-color-secondary-16` | `--primitive-color-secondary-71` | Ready |
| `--tertiary-color` | `--primitive-color-tertiary-43` | `--primitive-color-tertiary-84` | Ready |
| `--on-tertiary-color` | `--primitive-color-neutral-100` | `--primitive-color-tertiary-21` | Ready |
| `--tertiary-container-color` | `--primitive-color-tertiary-93` | `--primitive-color-tertiary-33` | Ready |
| `--on-tertiary-container-color` | `--primitive-color-tertiary-33` | `--primitive-color-tertiary-93` | Ready |
| `--error-color` | `--primitive-color-error-38` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--on-error-color` | `--primitive-color-neutral-100` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--error-container-color` | `--primitive-color-error-95` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--on-error-container-color` | `--primitive-color-error-29` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--background-color` | `--primitive-color-neutral-98` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--on-background-color` | `--primitive-color-neutral-11` | `--primitive-color-neutral-89` | Ready |
| `--surface-color` | `--primitive-color-neutral-98` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--on-surface-color` | `--primitive-color-neutral-11` | `--primitive-color-neutral-89` | Ready |
| `--surface-variant-color` | `--primitive-color-neutral-variant-90` | `--primitive-color-neutral-variant-30` | Ready |
| `--on-surface-variant-color` | `--primitive-color-neutral-variant-30` | `--primitive-color-neutral-variant-80` | Ready |
| `--outline-color` | `--primitive-color-neutral-variant-50` | `--primitive-color-neutral-variant-60` | Ready |
| `--outline-variant-color` | `--primitive-color-neutral-variant-80` | `--primitive-color-neutral-variant-30` | Ready |
| `--inverse-surface-color` | `--primitive-color-neutral-19` | `--primitive-color-neutral-89` | Ready |
| `--inverse-on-surface-color` | `--primitive-color-neutral-95` | `--primitive-color-neutral-19` | Ready |
| `--inverse-primary-color` | `--primitive-color-primary-85` | `--primitive-color-primary-43` | Ready |
| `--surface-dim-color` | `--primitive-color-neutral-85` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--surface-bright-color` | `--primitive-color-neutral-98` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--surface-container-lowest-color` | `--primitive-color-neutral-100` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--surface-container-low-color` | `--primitive-color-neutral-95` | `--primitive-color-neutral-11` | Ready |
| `--surface-container-color` | `--primitive-color-neutral-93` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--surface-container-high-color` | `--primitive-color-neutral-91` | `--primitive-color-magenta-unresolved` | Dark Blocked |
| `--surface-container-highest-color` | `--primitive-color-neutral-89` | `--primitive-color-magenta-unresolved` | Dark Blocked |

---

### 4.3. Typography Tokens

Typography tokens are defined at `:root`:

| Sub-category | Variable | Compiled Value | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Font Family** | `--font-family-sans` | `"Open Sans", -apple-system, ...` | Body text, UI controls, navigation |
| **Font Family** | `--font-family-display` | `"Playfair Display", Georgia, ...` | Hero editorial headlines |
| **Font Family** | `--font-family-mono` | `"JetBrains Mono", SFMono-Regular, ...` | Code, timestamps, monospaced data |
| **Font Size** | `--font-size-xs` | `0.75rem` (12px) | Footers, captions, tiny badges |
| **Font Size** | `--font-size-sm` | `0.875rem` (14px) | Secondary text, helper labels |
| **Font Size** | `--font-size-base`| `1rem` (16px) | Default body text, form inputs |
| **Font Size** | `--font-size-lg` | `1.125rem` (18px) | Card titles, prominent subheadings |
| **Font Size** | `--font-size-xl` | `1.25rem` (20px) | Section headers |
| **Font Size** | `--font-size-2xl`| `1.5rem` (24px) | Modal headings, page sub-headers |
| **Font Size** | `--font-size-3xl`| `1.875rem` (30px) | Page primary titles |
| **Font Size** | `--font-size-4xl`| `2.25rem` (36px) | Feature display banners |
| **Font Size** | `--font-size-5xl`| `3rem` (48px) | Large editorial titles |
| **Font Size** | `--font-size-6xl`| `3.75rem` (60px) | Hero titles |
| **Font Size** | `--font-size-7xl`| `4.5rem` (72px) | Expressive display headings |
| **Font Weight** | `--font-weight-light` | `300` | Light weight text |
| **Font Weight** | `--font-weight-regular` | `400` | Regular body weight |
| **Font Weight** | `--font-weight-medium` | `500` | Interactive controls, labels |
| **Font Weight** | `--font-weight-semibold` | `600` | Section headings, buttons |
| **Font Weight** | `--font-weight-bold` | `700` | Bold emphasis |
| **Font Weight** | `--font-weight-extrabold` | `800` | Heavy display headings |
| **Line Height** | `--line-height-none` | `1` | Icon alignment, numeric badges |
| **Line Height** | `--line-height-tight` | `1.25` | Compact headings |
| **Line Height** | `--line-height-snug` | `1.375` | Medium headings |
| **Line Height** | `--line-height-normal` | `1.5` | Standard readable body text |
| **Line Height** | `--line-height-relaxed` | `1.625` | Long-form editorial content |
| **Line Height** | `--line-height-loose` | `2` | Loose line spacing |
| **Letter Spacing** | `--letter-spacing-tighter` | `-0.05em` | Ultra-large display titles |
| **Letter Spacing** | `--letter-spacing-tight` | `-0.025em` | Headings |
| **Letter Spacing** | `--letter-spacing-normal` | `0em` | Standard text |
| **Letter Spacing** | `--letter-spacing-wide` | `0.025em` | Uppercase captions, pill labels |
| **Letter Spacing** | `--letter-spacing-wider` | `0.05em` | Expanded microcopy |
| **Letter Spacing** | `--letter-spacing-widest` | `0.1em` | Tracking for uppercase headers |

---

### 4.4. Spacing Scales

The design system provides both a standard rem-based scale (`--spacing-*`) and an 8pt-based Figma dimension collection (`--space-*`):

#### Standard Scale
- `--spacing-0`: `0`
- `--spacing-px`: `1px`
- Fractional steps: `--spacing-0-5` (`0.125rem` / 2px), `--spacing-1` (`0.25rem` / 4px), `--spacing-1-5` (`0.375rem` / 6px), `--spacing-2` (`0.5rem` / 8px), `--spacing-2-5` (`0.625rem` / 10px), `--spacing-3` (`0.75rem` / 12px), `--spacing-3-5` (`0.875rem` / 14px), `--spacing-4` (`1rem` / 16px).
- Standard multiples: `--spacing-5` (`1.25rem`), `--spacing-6` (`1.5rem`), `--spacing-8` (`2rem`), `--spacing-10` (`2.5rem`), `--spacing-12` (`3rem`), `--spacing-16` (`4rem`), `--spacing-20` (`5rem`), `--spacing-24` (`6rem`), up to `--spacing-96` (`24rem`).

#### Figma 8pt Dimension Scale
- `--space-0`: `0px`
- `--space-25`: `2px`
- `--space-50`: `4px`
- `--space-75`: `6px`
- `--space-100-base` (and `--space-100`): `8px` (Base grid unit)
- `--space-125`: `10px`
- `--space-150`: `12px`
- `--space-175`: `14px`
- `--space-200`: `16px`
- `--space-250`: `20px`
- `--space-300`: `24px`
- `--space-400`: `32px`
- `--space-450`: `36px`
- `--space-500`: `40px`
- `--space-600`: `48px`
- `--space-700`: `56px`
- `--space-800`: `64px`
- `--space-900`: `72px`

---

### 4.5. Border Radius Tokens

| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `--radius-none` | `0` | Flat, unrounded corners |
| `--radius-xs` | `0.125rem` (2px) | Subtle rounding for small tags |
| `--radius-sm` | `0.25rem` (4px) | Badges, small tooltips |
| `--radius-md` | `0.5rem` (8px) | Buttons, text inputs, dropdown menus |
| `--radius-lg` | `0.75rem` (12px) | Standard cards, alert containers |
| `--radius-xl` | `1rem` (16px) | Feature cards, bottom sheets |
| `--radius-2xl` | `1.5rem` (24px) | Modal dialogs |
| `--radius-3xl` | `2rem` (32px) | Hero callout containers |
| `--radius-full` | `9999px` | Fully rounded pill buttons, avatars |

---

### 4.6. Elevation, Shadows, and Effects

| Variable | Value | Usage |
| :--- | :--- | :--- |
| `--elevation-0` | `none` | Flat on canvas |
| `--elevation-1` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Raised card |
| `--elevation-2` | `0 3px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)` | Hovered card, dropdown |
| `--elevation-3` | `0 6px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)` | Floating action button |
| `--elevation-4` | `0 10px 20px rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.06)`| Bottom sheet, drawer |
| `--elevation-5` | `0 15px 30px rgba(0,0,0,0.14), 0 5px 10px rgba(0,0,0,0.08)`| Modal dialog |
| `--shadow-glow-primary` | `0 0 20px hsla(256, 34%, 48%, 0.35)` | Primary focus / highlight glow |
| `--shadow-glow-secondary` | `0 0 20px hsla(259, 11%, 40%, 0.35)` | Secondary accent glow |
| `--shadow-glow-tertiary` | `0 0 20px hsla(340, 21%, 41%, 0.35)` | Tertiary accent glow |
| `--shadow-glow-error` | `0 0 20px hsla(0, 54%, 41%, 0.35)` | Form validation error glow |
| `--effect-soft-shadow` | `2px 2px 12px 0px #00000029` | Figma soft elevation shadow |
| `--effect-medium-shadow` | `2px 4px 12px 0px #00000047` | Figma medium elevation shadow |
| `--effect-hard-shadow` | `2px 4px 8px 0px #00000052` | Figma high-contrast shadow |

---

## 5. Developer Guide: How to Use in Components

### 5.1. Importing the Stylesheet

Include `design-tokens.css` in your application root:

```html
<!-- In HTML header -->
<link rel="stylesheet" href="./design-tokens.css">
```

Or in your CSS bundle / entry point:
```css
@import './design-tokens.css';
```

---

### 5.2. Component Examples

#### Example 1: Accessible Primary Button
```css
.btn-primary {
  /* Layout & Spacing */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-125) var(--space-250);
  border-radius: var(--radius-md);

  /* Typography */
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);

  /* Semantic Color Role Pairing (Primary + On-Primary) */
  background-color: var(--primary-color);
  color: var(--on-primary-color);
  border: 1px solid transparent;

  /* Elevation */
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease-in-out;
}

.btn-primary:hover {
  box-shadow: var(--shadow-glow-primary);
  transform: translateY(-1px);
}
```

#### Example 2: Themed Content Card
```css
.card {
  /* Color Roles ensure automatic dark mode adaptation */
  background-color: var(--surface-color);
  color: var(--on-surface-color);
  border: 1px solid var(--outline-variant-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--elevation-1);
}

.card-title {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--on-surface-color);
  margin-bottom: var(--spacing-2);
}

.card-subtitle {
  font-size: var(--font-size-sm);
  color: var(--on-surface-variant-color);
}
```

#### Example 3: Error Message Banner
```css
.alert-error {
  /* Error Container + On-Error Container pairing */
  background-color: var(--error-container-color);
  color: var(--on-error-container-color);
  border: 1px solid var(--error-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}
```

---

### 5.3. Theme Switching Implementation

The compiled CSS supports three theme modes without requiring any changes to component classes:

1. **Default (Light)**: Applied automatically at `:root`.
2. **Explicit Light**: `<html data-theme="light">`
3. **Explicit Dark**: `<html data-theme="dark">`
4. **Auto System Dark**: Applied via `@media (prefers-color-scheme: dark)` whenever no explicit `data-theme="light"` override is present.

#### JavaScript Theme Switcher Example
```javascript
// Function to update the application theme
function setTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('rota-theme', theme);
}

// Restore saved theme on application initialization
const savedTheme = localStorage.getItem('rota-theme') || 'system';
setTheme(savedTheme);
```

---

## 6. DOs and DON'Ts

| Status | Code Pattern | Rationale |
| :---: | :--- | :--- |
| ❌ **DON'T** | `color: var(--primitive-color-neutral-11);` | Violates Tier 1 encapsulation. Hardcodes a light-mode value that will fail in dark mode. |
| ✅ **DO** | `color: var(--on-surface-color);` | Uses semantic color role. Switches automatically between light and dark palettes. |
| ❌ **DON'T** | `background-color: hsl(221, 85%, 55%);` | Hardcoded literal color. Bypasses design token governance. |
| ✅ **DO** | `background-color: var(--primary-color);` | Governed by token architecture and allows centralized rebranding. |
| ❌ **DON'T** | `background: var(--primary-color); color: var(--error-color);` | Randomly mixing roles without checking contrast. |
| ✅ **DO** | `background: var(--primary-color); color: var(--on-primary-color);` | Uses designated semantic pairs tested for accessible contrast (WCAG AA). |
| ❌ **DON'T** | Silently hardcode a dark color for unresolved magenta tokens. | Violates `design-system-rule.md`. Unapproved tokens must be reported, not guessed. |
| ✅ **DO** | Report unresolved dark tokens to the design owner. | Keeps code honest and aligned with product specifications. |

---

## 7. Converter Script Reference (`convert-tokens.js`)

### 7.1. Running the Script

Run using Node.js without any third-party dependencies:

```bash
# Run with default paths (design-tokens.tokens.json -> design-tokens.css)
node convert-tokens.js

# Run with custom input and output paths
node convert-tokens.js --input ./path/to/tokens.json --output ./dist/tokens.css

# View help and documentation flags
node convert-tokens.js --help
```

### 7.2. Script Capabilities
- **Tonal Palette Classifier**: Groups unique HSL colors into their proper foundational palettes (Neutral, Neutral Variant, Primary, Secondary, Tertiary, Error, Unresolved).
- **Two-Tier Variable Generator**: Generates immutable `--primitive-color-*` variables on `:root` and maps semantic `--[role]-color` variables via `var()`.
- **Theme Scoping**: Emits `:root` (default light), `[data-theme="light"]`, `[data-theme="dark"]`, and `@media (prefers-color-scheme: dark)`.
- **Figma Dimension Transformer**: Converts Figma dimension objects (`spacing collection`) into clean pixel values.
- **Figma Drop Shadow Transformer**: Converts Figma `custom-shadow` objects (`effect`) into valid CSS `box-shadow` strings.
- **Typography Formatter**: Quotes multi-word font family names and appends system fallback font stacks.
- **Alias Generator**: Provides both `--primary-color` and `--color-primary` aliases to support multiple component naming conventions.

### 7.3. Programmatic Usage in Node.js

```javascript
const { convertTokens, generateCss } = require('./convert-tokens.js');

// 1. Convert file to file
const stats = convertTokens('./design-tokens.tokens.json', './design-tokens.css');
console.log(`Converted ${stats.primitiveCount} primitives and ${stats.roleCount} roles.`);

// 2. Generate CSS string directly from an in-memory token object
const tokensData = require('./design-tokens.tokens.json');
const cssString = generateCss(tokensData);
```
