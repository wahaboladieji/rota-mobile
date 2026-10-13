---
name: design-system-screen-implementation
description: Create or change a Rota React Native screen or shared component. Load before styling; map supplied Matisse tokens through the central React Native theme, inspect product states and accessibility, and keep unresolved dark tokens blocked.
---

# Design system screen implementation

1. Read the screen's PRD flow, `AGENTS.md`, `design-system-rule.md`, and the checked-in `matisse-tokens-all.json`. Identify required actor, team context, states, labels, actions, and any D1–D6 decision gating content.
2. Reuse the typed central theme mapping for semantic color pairs, typography, spacing, radius, shadows, and elevation. If the mapping needs a token conversion, document one consistent React Native interpretation of HSL, rem/em, and CSS-only values there, not in the screen. Verify named font assets and weights rather than silently substituting.
3. Compose the React Native screen using the effective server-stored system/light/dark setting. Keep visual state coupled to server-confirmed outcomes. Make selected team clear where the wrong team would be harmful; show the switcher only for multiple memberships.
4. Render each relevant state: loading, empty, error, pending, success, offline last-updated, and restricted access. Communicate status with text or accessible labels as well as color. Keep controls operable with screen readers and larger system text.
5. Inspect light and dark variants, text scaling, and relevant long translated text after D6. Check foreground/background legibility and contrast. Treat the listed magenta `color.dark` entries in `design-system-rule.md` as unresolved; do not invent replacement colors or mark dark complete without corrected or explicitly approved tokens.
6. Record the inspected states and unresolved token/font issues in the task handoff. Do not claim a screen complete solely because it renders or compiles.

Use the mobile state skill for server data and offline behavior; design must not override authorization, payment, or settings truth.