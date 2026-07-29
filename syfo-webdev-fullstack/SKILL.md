---
name: syfo-webdev-fullstack
description: Build, migrate, validate, and package fullstack Next.js App Router applications for Syfo-hosted Alibaba Cloud Function Compute 3.0, normally with TiDB Cloud Starter or Essential. Use for SSR, Route Handlers, Server Actions, cookies, authentication, server secrets, database-backed workflows, or migrations from Cloudflare Workers, D1, SQLite, Vercel, and ordinary Node.js hosting. Produces a Next.js standalone artifact and syfo.yaml; Syfo backend services generate provider-specific s.yaml and FC infrastructure. Use syfo-webdev-static for fully build-time sites without application backend behavior.
---

# Syfo WebDev Fullstack for FC and TiDB

Produce a Next.js application that Syfo can deploy deterministically to Alibaba Cloud Function Compute 3.0 and connect to TiDB Cloud Starter or Essential.

The output is not ready merely because `next build` passes. Prove that the assembled standalone artifact starts on `0.0.0.0:$PORT`, passes health and representative HTTP checks, uses TiDB-compatible migrations, avoids secret leakage, and satisfies the `syfo.yaml` contract.

## Boundaries

- Read repository instructions before changing files. Project rules override this skill.
- Create or modify application code and the Syfo application declaration.
- Treat `syfo.yaml` as the application-to-Syfo contract. Syfo owns cloud resource IDs, credentials, domains, certificates, and generated FC infrastructure.
- Do not generate or maintain provider-specific `s.yaml`. Syfo backend services translate accepted `syfo.yaml` intent into provider deployment configuration.
- Never create or deploy paid cloud resources without explicit authorization.
- Never print or persist Alibaba Cloud, TiDB Cloud, DNS, certificate, Cookie, or application secret values.
- Verify region-sensitive FC runtime availability and version-sensitive TiDB behavior against current official documentation.

## Supported target

Default target:

```text
Next.js App Router
  -> output: standalone
  -> immutable FC artifact
  -> FC 3.0 custom runtime or approved custom container
  -> 0.0.0.0:$PORT, default 9000
  -> TiDB Cloud over TLS with bounded pooling
```

Use another skill for:

- Fully build-time sites without application backend behavior; use `syfo-webdev-static`.
- Cloudflare Workers or Pages deployment.
- Long-running non-HTTP workers.
- Applications requiring privileged containers or unsupported native runtimes unless the user approves a custom-container design.

## Required outputs

Deliver all applicable items:

1. Complete source code and one matching dependency lock file.
2. Next.js standalone configuration and deterministic artifact assembly.
3. `GET /healthz`, unauthenticated and without business writes.
4. `syfo.yaml` version 1 at the selected `appDir` root.
5. TiDB-compatible schema, migrations, connection layer, and contract tests when a database is required.
6. Local validation commands and machine-readable results.
7. Frontend capability selection and browser-quality evidence when user-visible UI is created or materially changed.
8. An immutable Git commit SHA or ZIP SHA-256 for final handoff.
9. For Syfo-authenticated Apps, an App-local user schema and first-login persistence path.

## Workflow

### 1. Resolve the application root

- Inspect the repository, package manager, workspace layout, Next.js version, router mode, current deployment configuration, and database implementation.
- Select one explicit `appDir`. Use `.` only for a single-app repository.
- In a monorepo, do not guess between plausible applications.
- State the base commit, branch, worktree, write set, dependencies, target region, and validation dependencies before implementation when required by the repository.

Run the bundled audit from the target application root:

```bash
node <skill-path>/scripts/doctor.mjs
```

Use `--json` when the result feeds automation. Treat findings as a review queue, not an automatic rewrite plan.

### 1A. Bind database-backed development to the allocated App TiDB

For a new Syfo Hosted App with `database.required: true`, initialize or select the
Hosted App before app-specific schema, seed, or workflow development. App Init is
the resource boundary: it provisions the App's physical TiDB database/account and
records the canonical `prod` database binding used by both local development and
deployment.

- Record the App ID and work inside the initialized App repository.
- Run App-specific migrations, seed commands, database contract tests, and local
  servers through `syfo app dev -- <command>`. Do not substitute an unrelated
  `.env`, another App's database, or a disposable TiDB database for this gate.
- `syfo app dev` must receive `TIDB_HOST`, `TIDB_PORT`, `TIDB_DATABASE`,
  `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_SSL`, and `DATABASE_URL` from the canonical
  platform binding. Fail closed if the binding is missing, incomplete, or uses
  `tidb.stub.apps.syfo.test`.
- Before the first App-data write, verify the connection without printing raw
  hostnames, database names, usernames, passwords, or DSNs. Log only booleans,
  table/count results, and one-way fingerprints when identity comparison is
  necessary.
- Run ordered migrations twice against the allocated App database, then verify
  migration history and representative seed/contract counts on that same binding.
- Treat disposable local or TiDB Cloud databases as compatibility test targets
  only. They do not satisfy allocated-App database acceptance.

If `syfo app dev` cannot retrieve the managed database environment, or the
allocated database is unexpectedly empty after a claimed migration, stop and
investigate the binding/provisioning lifecycle. Do not report database validation
as passed from a different connection.

### 2. Pass the frontend capability gate

Classify the user-visible scope as one of:

- `none`: infrastructure, database, manifest, artifact, or runtime work with no UI effect.
- `preserve`: the user explicitly wants existing UI behavior and appearance preserved.
- `new_ui`: a new application, page, app shell, authentication surface, or user workflow is being created.
- `material_change`: an existing interface is being redesigned or substantially extended.

For `new_ui` or `material_change`:

1. Inspect the frontend, design, UX, accessibility, responsive, and browser-validation skills available in the current agent environment.
2. Select the smallest appropriate capability set for this product and task. Do not require a specific named skill; available skills differ between environments.
3. State the selected capabilities, design rationale, and browser-validation plan before implementing UI.
4. Follow the selected capability's project-context and design workflow.
5. Validate the result against outcome-based acceptance criteria, not the selected skill name.

For `none` or `preserve`, record why the gate does not require a design workflow. Do not redesign an existing interface during a deployment-only migration.

Read `references/frontend-capability.md` before creating authentication pages, forms, dashboards, app shells, error states, or other user-visible UI.

### 3. Audit the current runtime

Identify:

- Code that assumes Vercel, Cloudflare bindings, D1, SQLite, Edge Runtime, or a persistent filesystem.
- Native modules, postinstall compilation, browser automation, image processing, or architecture-specific binaries.
- Background work performed inside HTTP requests.
- Process-local sessions, caches, locks, or state.
- Redirects and callback URLs derived from an internal or test hostname.
- Environment values that are public, server-only, platform-injected, or missing.

Classify every incompatibility as:

- Directly portable.
- Requires a code change.
- Requires Linux AMD64 build validation.
- Requires a custom container.
- Requires user or platform clarification.

### 4. Establish the FC runtime contract

The production server must:

- Start from built output, never `next dev`.
- Listen on `0.0.0.0` and `process.env.PORT`; default local validation to port `9000`.
- Run in the foreground and return non-zero on startup failure.
- Store no durable data or unique state on local disk.
- Write structured logs to stdout/stderr without credentials or full environment dumps.
- Stop accepting new work and close resources on termination when the runtime allows it.
- Use trusted proxy and public-origin configuration for redirects rather than the FC probe URL.

For Next.js, set `output: "standalone"`. Assemble `.next/standalone`, `.next/static`, and `public` into one immutable artifact.

Read `references/fc-runtime.md` and `references/nextjs-standalone.md` before changing runtime or build configuration.

### 5. Add the health contract

Provide `GET /healthz` with these semantics:

- No authentication.
- No business writes.
- Fast bounded response.
- Returns 2xx when the process can serve traffic.
- Does not expose secrets, build paths, stack traces, or full dependency details.

Keep liveness separate from expensive business readiness checks. Database connectivity may be tested in deployment acceptance without making every health request consume a database connection.

### 5a. Add Syfo authentication and App-local users

When the App uses Syfo login, start from `assets/syfo-auth` and keep its `src/_core/` boundary
server-owned. Do not recreate the OAuth callback ad hoc.

- Register the fixed callback path `/api/_core/syfo-auth/callback`.
- Validate ID-token signature, issuer, audience/authorized party, expiry, nonce, and the Hosted-App
  `appId` claim before creating a session or writing App data.
- Create `app_users` through the App's ordered migrations. The stable key is `(issuer, subject)`;
  never use email as identity.
- Transactionally upsert the App user after token validation and before session creation. A database
  failure must fail the login closed.
- Keep OAuth access, refresh, and ID tokens server-only. Do not persist them in `app_users`, return
  them from the browser session endpoint, or use them as Syfo Product API credentials.
- Store App-specific user fields in separate App-owned tables keyed by the local `app_users.id`.
- Treat the Hosted-App `orgMember` claim as a signed login-time snapshot for App-local behavior, not
  as authorization to call Syfo Product APIs.

Copy `assets/syfo-auth/migrations/0001_syfo_auth_users.sql` into the App migration set and add the
server-only `mysql2` dependency. Run the auth template contract test before handoff.

### 6. Migrate the database contract to TiDB

When `database.required` is true:

- Read connection settings only from `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, and `TIDB_DATABASE` unless the accepted Syfo manifest version defines a newer contract.
- Require TLS in deployed environments.
- Use a MySQL/TiDB-compatible driver and SQL dialect.
- Bound pool size per FC instance and configure connection lifetime or idle recycling for serverless database behavior.
- Keep migration credentials and runtime credentials conceptually separate, even if local development temporarily uses one account.
- Make migrations deterministic, auditable, repeatable, and non-zero on failure.
- Require explicit approval for destructive migrations.
- Test JSON string, number, boolean, null, array, and object round trips without unconditional double parsing.

Remove runtime dependencies on D1, SQLite, PostgreSQL-specific SQL, or provider binding APIs unless an intentionally separate subsystem still needs them.

Read `references/tidb-serverless.md` and `references/database-migration.md` before modifying schema or migrations.

### 7. Create `syfo.yaml`

Use the accepted Syfo manifest version and validate it against the repository contract. Start from `templates/syfo.nextjs-fullstack.yaml` when appropriate.

The manifest describes application intent. It must not contain:

- Cloud account identifiers.
- Function names or ARNs.
- Regions or actual domains.
- Connection strings or secret values.
- Certificate data.
- Shell interpolation that resolves secret values.

For a normal Next.js + TiDB application, declare:

- `app.type: nextjs`.
- Node.js runtime version supported by the platform.
- Frozen dependency installation.
- `next build` and `.next/standalone` output.
- Foreground standalone start command.
- Port 9000 and `/healthz`.
- TiDB requirement and migration command.
- Only application-owned required and optional environment-variable names.

The five `TIDB_*` variables and platform variables such as `PORT`, `HOSTNAME`, and `NODE_ENV` are platform-injected and should not be repeated as user-owned secrets.

Read `references/syfo-contract.md` for the validation gates.

### 8. Assemble the standalone artifact

After a successful build, run:

```bash
node <skill-path>/scripts/assemble-next-standalone.mjs \
  --project . \
  --output .fc/artifact
```

The script copies the standalone tree, `public`, and `.next/static`, then reports server entry candidates. Do not guess the start path when a monorepo produces multiple or nested `server.js` files; make the manifest command explicit.

Exclude development caches, source `.env*`, credentials, test databases, certificates, local logs, and unrelated workspace applications from the artifact.

### 9. Validate locally in layers

Read `references/local-validation.md` and execute the highest available tier.

Mandatory without cloud credentials:

1. Frozen clean dependency install.
2. Project-provided lint, typecheck, unit, and integration tests for the touched surface.
3. Production Next.js build.
4. Standalone artifact assembly and content verification.
5. Artifact start with `HOSTNAME=0.0.0.0` and `PORT=9000`.
6. `/healthz`, home page, representative public route, and key API smoke checks.
7. Secret and forbidden-platform-reference scan.
8. `syfo.yaml` consistency review.

When frontend scope is `new_ui` or `material_change`, also require:

- Real-browser validation at representative desktop and mobile widths.
- Authentication, loading, empty, error, disabled, and success states applicable to the workflow.
- Keyboard navigation, visible focus, readable contrast, responsive layout, and no console errors.
- No browser-default controls or obvious scaffold placeholders in a claimed finished surface.
- Screenshots or equivalent browser evidence for the primary user journey.

Do not mark frontend or browser validation as `passed` from source inspection or `next build` alone.

Run the reusable smoke harness as:

```bash
node <skill-path>/scripts/smoke-server.mjs \
  --port 9000 \
  --path /healthz \
  --path / \
  -- node .fc/artifact/server.js
```

For TiDB work, additionally run migrations twice and database contract tests against:

1. A disposable local TiDB environment when Docker is available.
2. A disposable TiDB Cloud database over TLS when credentials are explicitly provided.
3. The initialized Hosted App's allocated TiDB binding through
   `syfo app dev -- <command>` when this is a Syfo App implementation or migration.

A MySQL-only test is useful but does not replace TiDB validation. Disposable TiDB
validation does not replace the allocated-App binding gate in section 1A.

For native dependencies or Mac/ARM development, build and smoke-test in a Linux AMD64 container matching the intended FC execution architecture.

### 10. Prepare Syfo handoff

- Validate `syfo.yaml` as application intent rather than cloud infrastructure.
- Do not add region, function name, domain, certificate, account ID, AccessKey, provider runtime identifiers, or Serverless Devs access configuration.
- Record the artifact entry, required application-owned environment-variable names, source revision, and validation results.
- Hand the accepted manifest and immutable source/artifact identity to the Syfo backend deployment service.

Cloud resource creation, domain changes, certificate changes, destructive migrations, and production deployment remain backend-controlled operations requiring explicit human authorization.

### 11. Acceptance and handoff

Do not call the app FC-ready until mandatory local gates pass. Distinguish local readiness from cloud acceptance.

Cloud acceptance should cover:

- Function startup, port, timeout, memory, and concurrency.
- HTTPS custom-domain certificate match.
- Health, home page, static assets, login redirects, and representative APIs.
- At least one TiDB write/read transaction.
- Repeated migration behavior.
- Confirmation that local App validation and deployment use the same canonical
  allocated database binding, compared without exposing connection values.
- TLS and bounded connection pool behavior.
- Logs free from secrets, Cookies, Authorization, and private keys.
- A recorded artifact digest and rollback point.

## Required handoff

Return a human-readable summary followed by exactly one JSON object:

```json
{
  "skill": "syfo-webdev-fullstack",
  "source": {
    "type": "git",
    "revision": "FULL_COMMIT_SHA",
    "sha256": null
  },
  "appDir": ".",
  "manifest": "syfo.yaml",
  "artifact": ".fc/artifact",
  "serverEntry": ".fc/artifact/server.js",
  "target": {
    "platform": "aliyun-fc3",
    "region": null,
    "database": "tidb-cloud"
  },
  "requiredEnv": ["SESSION_SECRET"],
  "frontend": {
    "scope": "new_ui",
    "selectedSkills": ["agent-selected-skill"],
    "designDirection": "SHORT_DESCRIPTION",
    "desktopValidation": "passed",
    "mobileValidation": "passed",
    "accessibility": "passed",
    "knownGaps": []
  },
  "validation": {
    "install": "passed",
    "typecheck": "passed",
    "lint": "passed",
    "test": "passed",
    "build": "passed",
    "artifact": "passed",
    "start": "passed",
    "health": "passed",
    "httpSmoke": "passed",
    "migration": "passed",
    "migrationRepeat": "passed",
    "databaseContract": "passed",
    "browser": "passed",
    "linuxAmd64": "not_applicable",
    "cloudAcceptance": "not_run"
  },
  "notes": []
}
```

Use only `passed`, `failed`, `not_applicable`, or `not_run`. Never report `passed` for a command or scenario that was not executed.

## Stop conditions

Stop and ask rather than guessing when:

- Multiple application roots are plausible.
- Target region or runtime packaging mode changes the deployment design.
- A destructive database migration is required.
- The application needs an undeclared external service.
- Required Secrets or business acceptance scenarios cannot be determined.
- Native dependencies cannot be validated for the target Linux architecture.
- The app cannot run statelessly or within FC request/runtime limits.
