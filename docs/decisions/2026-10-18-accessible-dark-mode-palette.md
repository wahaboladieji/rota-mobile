# Decision: Replace placeholder dark mode tokens with accessible WCAG 2.1 AA/AAA palette

- **Date:** 2026-10-18
- **Type:** Approved design-token resolution / design system architecture
- **Status:** Approved (Product Lead)

## Context

Per `design-system-rule.md`, PRD v2 F7.3, and `design-tokens-documentation.md`, 16 dark mode color tokens in `design-tokens.tokens.json` were set to placeholder magenta `hsl(300, 100%, 50%)` (`#FF00FF`), marked `/* [UNRESOLVED TOKEN - BLOCKED] */`. This caused 28 of the 29 screens in `apps/frontend/` to render hot pink when dark mode was active, with critical accessibility failures (e.g., `on-error` on `error` was 1:1 contrast).

The Product Lead requested:
1. Setting up the design for dark mode when the app or device is set to dark mode.
2. Generating and saving dark mode color tokens that work in harmony with default tokens.
3. Replacing the existing placeholder dark mode system.
4. Testing, auditing, and reporting before implementation.

Following the audit report and explicit user confirmation, the dark mode palette was finalized and implemented.

## Decision

1. **Neutral Slate Elevation Ramp (`hsl(220, 15%, ...)`):**
   - Harmonizes with the brand royal blue palette (`hsl(221, 85%, 55%)`) by utilizing a subtle cool slate undertone:
     - `background`: `hsl(220, 15%, 8%)` (#111317) - 14.48:1 contrast with `on-background` (`#E3E3E3`)
     - `surface`: `hsl(220, 15%, 10%)` (#15171C) - 13.85:1 contrast with `on-surface` (`#E3E3E3`)
     - `surface-dim`: `hsl(220, 15%, 6%)` (#0D0E11)
     - `surface-bright`: `hsl(220, 12%, 20%)` (#2C3038)
     - `surface-container-lowest`: `hsl(220, 15%, 6%)` (#0D0E11)
     - `surface-container-low`: `hsl(220, 14%, 11%)` (#181B20)
     - `surface-container`: `hsl(220, 13%, 14%)` (#1F2228) - 12.43:1 contrast with `on-surface`
     - `surface-container-high`: `hsl(220, 12%, 17%)` (#262A31)
     - `surface-container-highest`: `hsl(220, 11%, 20%)` (#2C313A) - 9.85:1 contrast with `on-surface`
     - `neutral-99`: `hsl(220, 13%, 15%)` (#21252C)

2. **Accessible Error Palette:**
   - `error`: `hsl(358, 100%, 69%)` (#FF6166) - 6.06:1 contrast against dark surface
   - `on-error`: `hsl(359, 100%, 15%)` (#4D0001) - 5.44:1 contrast on error button
   - `error-container`: `hsl(359, 70%, 18%)` (#4E0E0F)
   - `error-container-high`: `hsl(359, 65%, 24%)` (#65151A)
   - `on-error-container`: `hsl(7, 100%, 88%)` (#FFC9C2) - 10.32:1 contrast in error container
   - `error-98`: `hsl(359, 50%, 13%)` (#321111) - 13.37:1 contrast with `on-surface` text

3. **Primary & Button Alignment:**
   - `on-primary` in dark mode set to `hsl(0, 0%, 100%)` (#FFFFFF) on `primary` (`hsl(221, 85%, 55%)`), achieving 4.86:1 WCAG AA compliance (correcting the previous 2.74:1 failure).
   - `primary-95`: `hsl(221, 55%, 20%)` (#172A52) - Soft dark container tint.

4. **App Integration:**
   - `StatusBar` dynamically switches between `dark-content` (light mode) and `light-content` (dark mode) across all root screens.
   - `ThemedAppContainer` in `App.tsx` synchronizes `ThemeProvider` with authoritative `serverSettings?.theme` ('LIGHT' | 'DARK' | 'SYSTEM').

## Applied Files

- `design-tokens.tokens.json`
- `convert-tokens.js` & `design-tokens.css`
- `apps/frontend/src/theme/tokens.ts`
- `apps/frontend/App.tsx`
- `apps/frontend/src/features/welcome/WelcomeScreen.tsx`
- `apps/frontend/src/features/settings/SettingsPreferencesScreen.tsx`
- `docs/design-tokens-documentation.md`
