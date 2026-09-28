# FC static-serving adapter

## Role

The adapter is deployment infrastructure, not an application backend. It serves immutable files and health responses only.

## Runtime contract

- Listen on `0.0.0.0` and `process.env.PORT`; use 9000 for local validation.
- Run in the foreground and return non-zero when startup fails.
- Do not write durable data or keep business state in process memory.
- Log concise request-independent startup/shutdown information without environment dumps.
- Handle graceful termination when practical.

## HTTP behavior

- `GET /healthz` returns a small 2xx response without filesystem mutation or external calls.
- `/healthz` bypasses visitor access checks so platform health probes remain independent.
- All non-health requests delegate platform Basic Auth policy verification to the Syfo verifier.
- Missing verifier configuration or verifier failures fail closed with 503; challenged visitors receive 401 with the verifier-provided `WWW-Authenticate` header.
- `GET` and `HEAD` serve exported files.
- Resolve `/path` through exact file, `/path.html`, and `/path/index.html` candidates.
- Unknown routes use exported `404.html` with status 404 when present.
- Do not enable SPA fallback by default.
- Support one valid byte range for audio and video; return 416 for invalid ranges.
- Use correct content types and `Accept-Ranges: bytes` for files.
- Cache `/_next/static/` immutably; avoid aggressive caching for HTML.
- Resolve the artifact root and every served file through `realpath`; reject symlinks that escape the public root.

## Artifact layout

```text
.fc/artifact/
  server.mjs
  public/
    index.html
    404.html
    _next/
    ...exported assets
```

The project-local assembly script owns this layout. The Syfo backend converts `syfo.yaml` into provider-specific deployment configuration.
