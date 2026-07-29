# Next.js static-export decisions

## Eligible behavior

- Server Components whose data is available during `next build`.
- Static metadata and build-time content loading.
- Client Components and browser-only state.
- Dynamic routes with a complete `generateStaticParams()` result.
- Calls from the browser to approved public APIs without private credentials.

## Fullstack blockers

- `cookies()`, `headers()`, draft mode, request-dependent redirects, or request-time personalization.
- Server Actions and mutation handlers.
- Route Handlers that must execute per request.
- Middleware or proxy logic.
- Server-only secrets, authentication, authorization, databases, uploads, webhooks, queues, or scheduled work.
- ISR or content freshness that cannot wait for a new build.
- Dynamic routes whose parameter space is not known during the build.

## Route behavior

- Prefer generated route-specific HTML and real 404 responses.
- Do not enable SPA fallback merely to hide missing exported routes.
- Test direct navigation and refresh for every representative route shape.
- Keep `basePath`, `assetPrefix`, and trailing-slash behavior aligned with the public URL contract.

## Images

- Runtime image optimization is unavailable in a pure static export.
- Use source-controlled optimized assets, an approved custom loader, or `images.unoptimized` as an explicit tradeoff.
- Verify rendered dimensions, responsive sources, layout stability, and missing-image behavior.
