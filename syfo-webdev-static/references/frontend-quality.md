# Static frontend completion checklist

## Structure

- Global layout and navigation exist before isolated pages.
- Every route has an escape path; no placeholder route remains.
- Shared patterns are components rather than copied markup.
- Metadata, titles, descriptions, icons, and social previews match the product.

## Accessibility

- Semantic landmarks and heading order are coherent.
- Keyboard users can reach and operate every control.
- Focus remains visible.
- Text contrast is evaluated against the actual rendered background.
- Images have appropriate alternative text.
- Motion respects `prefers-reduced-motion`.

## Responsive behavior

- Validate narrow mobile, tablet, desktop, and wide layouts.
- Prevent overflow from long words, URLs, localized text, tables, and media controls.
- Navigation remains usable at every breakpoint.

## Browser quality

- No hydration failures or console errors.
- Direct navigation and refresh work on nested routes.
- Missing routes show the intended 404.
- Asset URLs work under the configured public origin and path behavior.
- Audio/video playback and seeking work when present.
