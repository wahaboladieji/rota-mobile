---
trigger: glob
---

# Design System Rule

Apply this rule to Rota's React Native with Expo app whenever creating or changing screens, shared components, styles, fonts, or theme behavior. Read `AGENTS.md`, `docs/Rota_PRD_v2.md`, and the checked-in `design-tokens.tokens.json` before implementation.

The PRD defines product behavior and scope. `AGENTS.md` defines project constraints. `design-tokens.tokens.json` defines the supplied visual values. A visual token does not authorize a new feature or a change to a business rule. This export replaces `matisse-tokens-all.json` as this rule's visual source; do not merge values from the old export into the new theme.

## Token authority and shared mapping

- Keep the supplied JSON unchanged in the repository until a design correction is approved. Preserve its token names, light and dark sets, and Figma metadata. Record approved corrections in the source and the project's decision record.
- Build one typed, shared React Native mapping from the checked-in JSON. Screens and components must consume this mapping or shared component styles built from it. Do not copy token values into individual screens or create a separate theme palette.
- Support the export's two structures: primitive values under `color`, `typography`, `spacing`, `borderRadius`, `shadows`, and `elevation`; and objects with `type`, `value`, and `extensions` under `spacing collection` and `effect`. Read object tokens through their `value`; metadata is not a style value.
- Keep source paths traceable through any aliases. For example, a primary action background must resolve to the active theme's `primary-color`, and its label to `on-primary-color`.
- Do not add arbitrary colors, spacing, radii, type sizes, font weights, or decorative effects to finish a screen. Reuse an existing approved component mapping. Where a required role or state has no approved mapping, identify the gap and obtain a design decision.

## Semantic colors and themes

- Select colors from `color.light` or `color.dark` using the effective theme. Use matching foreground/background roles: `primary-color` with `on-primary-color`, `primary-container-color` with `on-primary-container-color`, and the equivalent secondary, tertiary, and error pairs.
- Use `background-color` with `on-background-color`, `surface-color` with `on-surface-color`, `surface-variant-color` with `on-surface-variant-color`, and `inverse-surface-color` with `inverse-on-surface-color` for their corresponding contexts.
- Use the supplied surface-container roles for approved surface hierarchy and `outline-color` or `outline-variant-color` for approved borders. Container roles without their own foreground token need a centrally documented, verified foreground pairing; do not invent an `on-*` token.
- Do not treat secondary or tertiary colors as success, warning, or payment-status colors without an approved semantic mapping. Communicate status with text and accessible indicators as well as color.
- React Native may use supported HSL color strings directly. If conversion is required by an API, centralize it and preserve the source color. Do not make component-local approximations.
- Honor the server-stored `system`, `light`, and `dark` preference. Resolve `system` from the device's current appearance and respond to appearance changes. Refetch settings on launch and foreground as required by the PRD. If an optimistic settings update fails, restore the prior effective theme; do not maintain a conflicting local preference. [PRD F7.3–F7.4]

## Typography

- Map `font-family-sans` to Open Sans, `font-family-display` to Playfair Display, and `font-family-mono` to JetBrains Mono. Use the role specified by the approved component or design; the presence of a display font does not require using it for every heading.
- Load and verify the required font assets and weights in Expo. The supplied weight scale is 300, 400, 500, 600, 700, and 800. Map each used weight to an available font face. Do not silently substitute a font or synthesize an unavailable weight.
- Use the supplied `font-size-xs` through `font-size-7xl`, line-height scale, and letter-spacing scale. Do not replace them with framework defaults because the names look similar.
- Convert `rem` font sizes using one documented reference size. Convert unitless line-height multipliers into numeric React Native line heights relative to the mapped font size, and `em` letter spacing into numeric values relative to that font size. Confirm an existing project baseline before introducing one; the export does not specify it.
- Preserve system text scaling. Do not disable font scaling or force fixed-height text containers to hide wrapping. Verify headings, labels, buttons, and supporting text at larger accessibility text sizes.

## Spacing and radius

- Preserve both `spacing` and `spacing collection` as separate source namespaces. Their names are not interchangeable: `spacing.spacing-4` is `1rem`, while `spacing collection.space 100 (base).value` is `8`.
- The Figma collection contains values 0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 36, 40, 48, 56, 64, and 72. These are token values, not instructions to derive sizes from names such as `space 25` or `space 200`.
- Centralize `rem` and `px` conversions and document how unitless Figma dimensions map to React Native layout units. Do not assume CSS pixels, physical device pixels, and React Native layout units are interchangeable. If the repository has no established unit convention, resolve it before claiming exact design fidelity.
- Use one approved spacing mapping consistently within shared components. Do not mix the two source scales ad hoc. Preserve both namespaces even when two tokens resolve to the same number.
- Use `borderRadius.radius-none` through `radius-3xl` and `radius-full` where the approved design calls for them. Convert dimensions centrally. Use `radius-full` for approved pill or circular shapes; do not round every component by default.
- React Native layout properties require numeric dimensions or supported native values. Do not pass raw `rem`, `em`, or CSS shadow strings into native styles.

## Shadows, elevation, and Figma effects

- Preserve `shadows`, `elevation`, and `effect` as distinct sources. Do not combine them on a component unless its approved design requires that combination.
- Map CSS shadow strings and the Figma `hard shadow`, `medium shadow`, and `soft shadow` objects through a shared platform-aware adapter. Preserve offsets, color and alpha, spread, and blur semantics where the installed React Native/Expo version supports them. Verify the Figma `radius` interpretation; do not assume it is numerically equivalent to every native shadow property.
- Select shadow APIs supported by the project's installed versions and target platforms. Android elevation is not an exact conversion of a CSS shadow. Document platform limits and obtain an approved fallback where exact rendering is unavailable; do not silently claim parity.
- The `shadow-glow-*` values contain their own colors, which differ from the current semantic palette. Do not recolor them automatically or infer that they are required for buttons, validation, or selection. Use them only where the approved design specifies them, and raise any intended-color conflict.

## Unresolved dark-theme values

- The current export sets all of these `color.dark` roles to the same `hsl(300, 100%, 50%)` value: `error-color`, `on-error-color`, `error-container-color`, `on-error-container-color`, `background-color`, `surface-color`, `surface-dim-color`, `surface-bright-color`, `surface-container-lowest-color`, `surface-container-color`, `surface-container-high-color`, and `surface-container-highest-color`.
- Treat these roles as unresolved design data. The error foreground/background pairs are identical and cannot distinguish their contents. Do not silently replace the values, copy light-theme colors into dark mode, ship them as verified dark styling, or claim the dark theme is complete.
- Obtain corrected values or an explicit design decision. Identical foreground/background values still require a readable approved pairing before acceptance. Update the token source and shared mapping together after correction.
- Continue independent light-theme work and theme-selection infrastructure while this is unresolved. Report affected dark screens as blocked against the PRD's theme requirement; do not remove dark-mode support to bypass the issue. [PRD F7.3]
- Check every foreground/background pairing actually used in both themes, including primary actions, errors, icons, disabled controls, and focus indicators. Token names alone do not prove contrast or legibility. Report failing pairs and their screens instead of correcting them locally.

## Product states, navigation, and accessibility

- Render the PRD's real states: feed loading, empty, end, error, refresh, and rapid scrolling; offline shifts with the last successful sync time; pending and failed payments without false activation; restricted billing access; and swap pending, rejected, cancelled, and approved states as permitted by recorded D2/D3 decisions. Never represent a server failure as success. [PRD F3–F6]
- Make the selected team and membership role clear. Show the team switcher only for users with multiple memberships. Server authorization remains authoritative, including when opening notification deep links. Visual hiding does not replace access checks. [PRD F1, F7]
- Reuse shared components and their approved state styles. Loading, disabled, validation, selected, and pressed states must remain distinguishable without introducing screen-local tokens.
- Keep layouts usable with system text scaling, safe areas, keyboard interaction, touch access, and screen-reader labels for controls and status changes. Do not communicate shift, swap, payment, or error status through color alone.
- Verify long text in both supported languages once D6 identifies the second language. Do not choose the language or add unsupported localization scope. [PRD F7.3; D6]

## Completion evidence

- Inspect each changed screen on the project's supported platforms and theme settings. Include its relevant loading, empty, error, offline, restricted, and interactive states. Explicitly record dark variants blocked by unresolved source tokens.
- Verify that rendered colors, fonts, spacing, radii, and effects trace to the shared mapping; fonts load at the required weights; text remains usable at larger system sizes; and theme changes and failed settings updates produce the required behavior.
- Report missing design decisions, unresolved dimension conventions, unavailable fonts, shadow conversion limits, and failing color pairs. Compilation alone is not completion when a required theme or product state is unreadable or uses an unapproved substitute.