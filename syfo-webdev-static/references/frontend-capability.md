# Frontend capability gate

## Purpose

This skill owns static eligibility and FC delivery, not one prescribed visual style. When a task creates or materially changes user-visible UI, select the best frontend capabilities available in the current agent environment and judge the result by product quality and browser evidence.

Do not hard-code one named frontend skill. Different environments may provide different specialists for branding, product UI, accessibility, responsive adaptation, design systems, motion, or browser iteration.

## Scope classification

- `none`: no user-visible UI change.
- `preserve`: packaging or migration work where appearance must remain unchanged.
- `new_ui`: a new site, page, navigation system, form, onboarding flow, or content experience.
- `material_change`: substantial redesign or extension of an existing interface.

## Selection protocol

1. Inspect available frontend, design, UX, accessibility, responsive, and browser-validation skills.
2. Choose the smallest capability set that fits the product and requested quality level.
3. Prefer project-aware capabilities that consume existing product or design context.
4. State the selected names and why they fit; if no specialist exists, use this reference as the fallback.

Before UI implementation, report:

```text
FRONTEND_CAPABILITY_GATE: scope=<none|preserve|new_ui|material_change> selected=<names|fallback|none> rationale=<short reason> browser_plan=<routes, states, viewports>
```

## Outcome requirements

- Establish a deliberate design direction rather than an automatic generic landing-page or SaaS aesthetic.
- Use coherent typography, color, spacing, radius, elevation, and interaction tokens.
- Build reusable components and consistent states.
- Avoid unintended browser-default controls and obvious scaffold placeholders.
- Treat navigation, forms, errors, empty states, loading states, and completion states as finished product surfaces.
- Preserve readable hierarchy, balanced space, visible focus, sufficient contrast, responsive reflow, and useful copy.

## Browser acceptance

Exercise representative routes in a real browser at desktop and mobile widths. Verify:

- Direct navigation, refresh, and real 404 behavior.
- Hover, focus, active, disabled, loading, success, and error states when applicable.
- Keyboard-only operation and visible focus.
- No horizontal overflow, clipped text, hydration errors, asset failures, or console errors.
- Media playback and seeking when the site contains audio or video.

Capture screenshots or equivalent visual evidence. Static export success alone does not prove interface quality.

## Failure conditions

Frontend acceptance is `failed` or `not_run`, never `passed`, when browser validation was skipped for a new or materially changed UI, when unintended default controls or placeholders remain, or when desktop/mobile layouts have obvious hierarchy, overflow, contrast, or interaction defects.
