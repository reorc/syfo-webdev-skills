# Syfo static application contract

The baseline contract is `syfo.yaml` version 1 unless the repository contains a newer approved specification.

## Required behavior

- Place `syfo.yaml` at the selected `appDir` root.
- Keep every path relative to `appDir` and contained within it.
- Use one matching dependency lock file and a frozen install command.
- Use `package-lock.json`, `npm ci`, and `npm run build` for the official template; keep any
  migrated package manager internally consistent instead of switching it implicitly.
- Declare deterministic install, build, artifact, run, health, environment-name, and routing behavior.
- Use `app.type: nextjs`, static artifact output `.fc/artifact`, and `node server.mjs` inside that artifact.
- Declare `database.required: false`; do not declare TiDB variables.
- Keep cloud resource IDs, regions, actual domains, credentials, secret values, certificates, and provider runtime identifiers out of the manifest.
- Syfo backend services translate the accepted manifest into provider-specific `s.yaml` and FC infrastructure.

## Rejection conditions

- Unknown manifest version.
- Missing or mismatched lock file and frozen install command.
- Multiple dependency lock files.
- Compound manifest build commands instead of a project-owned build script.
- Missing `output: "export"` or missing exported `out/` after build.
- Missing artifact assembly or static server entry.
- Health endpoint failure.
- Database requirement, server secret, or request-time backend behavior.
- Path escape or absolute project path.
- Secret-like value, cloud account ID, actual domain, certificate, AccessKey, or connection string.
- SPA fallback without an explicit product requirement and direct-navigation tests.

## Static baseline

The application remains a static Next.js product even though FC needs a small HTTP process to serve its exported files. The adapter does not own application users or credentials, mutate data, call TiDB, or render application pages per request. It may delegate platform access-policy verification to Syfo using platform-injected runtime credentials.
