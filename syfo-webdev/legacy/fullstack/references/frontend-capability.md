# Frontend capability gate

## Purpose

The deployment skill owns runtime correctness, not a fixed visual style. When a task creates or materially changes user-visible UI, use the best frontend capabilities available in the current agent environment and judge the result by product quality and browser evidence.

Do not hard-code a dependency on one named design skill. Environments may provide different skills for product design, branding, accessibility, responsive adaptation, design systems, forms, animation, or browser iteration.

## Scope classification

- `none`: no user-visible UI change.
- `preserve`: deployment or backend work where existing UI must remain unchanged.
- `new_ui`: new page, application, authentication flow, app shell, form, dashboard, onboarding, or empty state.
- `material_change`: substantial redesign or extension of an existing surface.

Only `new_ui` and `material_change` require frontend capability selection. Do not force a redesign into infrastructure-only work.

## Selection protocol

1. Inspect available frontend, design, UX, accessibility, responsive, and browser-validation skills.
2. Choose the smallest set that covers the product surface and requested quality level.
3. Prefer project-aware skills that read existing product/design context when such context exists.
4. State the selected skill or capability names and why they fit the task.
5. If no specialist skill is available, apply this reference directly and report that fallback.

Before UI implementation, report:

```text
FRONTEND_CAPABILITY_GATE: scope=<none|preserve|new_ui|material_change> selected=<names|fallback|none> rationale=<short reason> browser_plan=<routes, states, viewports>
```

## Outcome requirements

For a claimed finished UI:

- Establish a deliberate design direction appropriate to the product rather than using an unexamined generic SaaS style.
- Use consistent typography, color, spacing, radius, elevation, and interactive-state tokens.
- Reuse or establish coherent components instead of styling isolated elements ad hoc.
- Treat authentication, error, empty, loading, disabled, and success states as product surfaces, not placeholders.
- Do not ship raw browser-default buttons, inputs, selects, or links unless the visual direction intentionally requires them and browser evidence supports that choice.
- Avoid oversized typography, unbalanced empty space, broken hierarchy, inaccessible contrast, invisible focus, dead-end navigation, and desktop-only layouts.
- Keep copy concise, specific, and useful. Explain privacy, access restrictions, and next actions where relevant.

## Browser acceptance

Exercise the primary journey in a real browser at representative desktop and mobile widths. Check:

- Initial page load and direct navigation.
- Hover, focus, active, disabled, loading, success, and error behavior.
- Keyboard-only operation and visible focus.
- Responsive reflow without clipped content or horizontal overflow.
- Console, hydration, asset, and network errors.
- Authentication redirects and recovery from failed or cancelled login when applicable.

Capture screenshots or equivalent visual evidence. Source review, lint, and build success do not prove frontend quality.

## Failure conditions

Frontend acceptance is `failed` or `not_run`, never `passed`, when:

- The browser was not exercised for a new or materially changed UI.
- The primary page still contains unintended browser-default controls or scaffold placeholders.
- Required loading, error, empty, or authentication states were not checked.
- Desktop or mobile layout has obvious hierarchy, overflow, contrast, or interaction defects.
- The agent cannot identify the design direction or selected frontend capability.
