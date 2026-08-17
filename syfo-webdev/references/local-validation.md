# Local validation strategy

Validation has two independent dimensions:

- **Mode** decides whether a local production build is appropriate for this change.
- **Tier** records which environment and acceptance surfaces were actually exercised.

Never infer a passed tier from the selected mode. Report unavailable or intentionally skipped
checks as `not_run`, never `passed`.

## Validation modes

### `fast`

Use by default for routine product logic, copy, styling, icons, and ordinary API changes that do
not affect a production-risk trigger below.

Required gates for the official Next.js 16 template:

```bash
npm ci
npm run typegen
npm run typecheck
npm run lint
npm test
syfo app validate --json
```

For Next.js 16+, `typegen` must run `next typegen`; bare `tsc --noEmit` does not validate generated
route signatures. For database-enabled websites, additionally run:

```bash
syfo app dev -- npm run db:migrate
```

Run focused development-server, HTTP, and browser smoke when behavior changed. `fast` deliberately
does not cover the production bundle, standalone artifact, artifact budget, production server,
complete static generation, or target-architecture behavior.

### `production`

Run all `fast` gates plus production build, artifact, runtime, and relevant target-architecture
checks when any of these apply:

- First deployment.
- Next.js, React, Node, package-manager, or lockfile changes.
- `next.config.*`, middleware/proxy, route wrappers, build scripts, standalone assembly, runtime
  entrypoints, native dependencies, or image pipeline changes.
- Server-module initialization, environment loading, static generation, or route-discovery changes.
- A prior cloud build failure is not fully explained by a fast-gate failure.
- The user explicitly requests production acceptance.

### `diagnostic_exception`

After a cloud build failure, first read the recorded operation with:

```bash
syfo app operation <operation-id> --app-id <app-id> --json
```

If the structured diagnostic or Build Service logs identify a fast-gate issue, fix it and rerun
`fast`. If logs are unavailable or incomplete, or the failure involves bundling, artifact assembly,
or static generation, run the `production` checks once as a diagnostic exception. Record the reason
and result. The exception does not authorize another deployment and must not become an unbounded
local-build retry loop.

## Validation tiers

Run the tiers required by the selected mode and change risk. Report all others explicitly.

## Resource-constrained hosts

Do not treat low memory or process limits as permission to downgrade a selected `production` or
`diagnostic_exception` run silently. When a Node.js install, test, build, artifact assembly, or
migration fails with resource evidence such as `SIGABRT`, `pthread_create: Resource temporarily unavailable`, `Cannot fork`, worker termination, or an out-of-memory error:

1. Record the original command, exit status, and resource error.
2. If a configured package mirror rejects the frozen install, retry the npm command with `--registry=https://registry.npmjs.org` without changing the lock file or persisting a global registry override.
3. Retry the affected command once with constrained Node resources:

   ```bash
   UV_THREADPOOL_SIZE=1 \
   NODE_OPTIONS='--v8-pool-size=1 --max-old-space-size=768' \
   <original-command>
   ```

   Also set any repository-supported test or build worker limit to `1`; do not invent unsupported framework flags.
4. If the constrained retry succeeds, continue the selected mode's remaining validation workflow.
5. If it still fails for resource reasons, mark only the blocked local build, runtime, test, or browser checks as `not_run`. Continue Tier 0 checks and any independent manifest, artifact-input, secret, database migration, and database contract validation that can still execute safely.

Never report skipped production checks as passed. A successful `fast` run means fast-gate readiness,
not local production readiness. For an authorized deployment, the Syfo clean build environment must
rebuild from the immutable source, reach a terminal successful version, and pass `/healthz` plus
required access-aware cloud smoke before completion can be claimed.

## Tier 0: static audit

- Repository instructions and write set reviewed.
- Lock file matches the package manager.
- Install, build, migration, output, and run commands match that single lock file and the assembled artifact contract.
- No secret values in source, manifests, artifacts, or logs.
- No runtime D1, SQLite, Cloudflare binding, or Edge Runtime dependency remains.
- `syfo.yaml` paths and commands match repository files.

## Tier 1: host validation and runtime

- Frozen install.
- Next.js framework type generation before TypeScript checking when supported or required.
- Focused lint, typecheck, unit, and integration tests.
- In `production` and `diagnostic_exception`: production build and standalone artifact assembly.
- In `production` and `diagnostic_exception`, run `node <skill-path>/scripts/check-artifact-budget.mjs --artifact .fc/artifact` and require zero Builder-compatible size/file violations.
- Review its Top dependency and hint output. Remove build-only packages and non-target native variants from the assembled runtime tree; do not raise the 70 MiB limit to mask packaging drift.
- In `production` and `diagnostic_exception`, start the artifact on `0.0.0.0:9000`.
- Run health, home, representative page/API, static assets, and redirect smoke checks against the
  production server when it was built; otherwise report development-server smoke separately.
- SIGTERM shutdown check where practical.
- For `new_ui` or `material_change`, record the selected frontend capability and validate primary desktop/mobile journeys in a real browser.
- Do not pass frontend acceptance when unintended default controls, scaffold placeholders, console errors, inaccessible focus, or obvious responsive defects remain.

## Tier 2: disposable local TiDB

- Start a pinned official TiDB development image or approved local environment.
- Wait for readiness rather than sleeping a fixed duration.
- Run migrations twice.
- Run repository and JSON contract tests.
- Exercise pool exhaustion protection and reconnect behavior when practical.
- Destroy the disposable data after the test unless debugging is requested.

## Tier 3: Linux target architecture

Required when native modules, browser binaries, image libraries, or host-generated executables exist.

- Install and build in a Linux container matching target architecture.
- Assemble and start the artifact inside that environment.
- Run Tier 1 smoke checks against the container.
- Do not copy Mac or Windows dependency directories into the artifact.

## Tier 4: disposable TiDB Cloud

Only with explicit credentials and an isolated database:

- Connect over TLS with certificate verification.
- Run migrations twice.
- Run database contract tests.
- Confirm bounded pool settings.
- Drop or clean the disposable test objects according to the approved policy.

## Tier 5: FC acceptance

Only with deployment authorization:

- Deploy a non-production version.
- Probe the FC URL internally.
- Validate the custom HTTPS domain externally.
- Check health, assets, redirects, API, database write/read, logs, and rollback metadata.
- Read the configured access policy from `syfo app status --json`; do not modify it. Verify anonymous
  2xx for public mode. For Basic Auth, verify anonymous 401 plus `WWW-Authenticate: Basic` and
  authorized 2xx only when a human explicitly supplies a test credential. For login/org policies,
  use an available authorized human session or report the acceptance gap.
- Scan output for leaked secrets before sharing logs.
