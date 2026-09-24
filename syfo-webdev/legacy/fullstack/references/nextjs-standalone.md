# Next.js standalone source and Syfo artifact

## Build configuration

Configure the existing Next.js config with:

```ts
const nextConfig = {
  output: "standalone",
};
```

Preserve unrelated configuration. In a monorepo, review output-file tracing root and the generated directory layout instead of assuming `server.js` is at the artifact root.

## Required artifact content

The project build script assembles `.fc/artifact`. Its source inputs are:

- The complete `.next/standalone` tree.
- `.next/static` copied under the standalone tree at `.next/static`.
- `public` copied into the standalone tree when present.
- The generated standalone server entry and traced runtime dependencies.

Do not declare or deploy `.next/standalone` directly. Copy it into `.fc/artifact`, add static and
public assets, and declare `build.output: .fc/artifact` with `run.command: node server.js`.

## Start validation

Start the assembled artifact, not the project source:

```bash
HOSTNAME=0.0.0.0 PORT=9000 node .fc/artifact/server.js
```

Adapt the entry path for monorepos. Test direct navigation, static chunks, images, fonts, API routes, redirects, and `/healthz`.

## Forbidden assumptions

- Development server availability.
- Writable durable local filesystem.
- Vercel-specific request metadata.
- Cloudflare bindings or Edge Runtime.
- Build-machine absolute paths.
- Host architecture compatibility for native modules.
