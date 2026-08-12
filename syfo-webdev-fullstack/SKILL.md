---
name: syfo-webdev-fullstack
description: "Use whenever a user asks to create, build, continue, fix, migrate, validate, package, publish, deploy, or take live a fullstack Syfo App or Syfo Hosted App. Trigger without being named when the request or repository indicates Syfo hosting, including app, Hosted App, 上线, 部署, syfo.yaml, syfo app init, syfo app validate, or syfo app deploy. Use for SSR, Route Handlers, Server Actions, cookies, application auth, server secrets, request-time behavior, durable writes, TiDB/database workflows, or migration from Cloudflare Workers, D1, SQLite, Vercel, or Node hosting. Own the full lifecycle: choose/init the template or bind an existing repo, implement, validate through the allocated App database when needed, create and push immutable source, prepare the human-confirmed deploy, check status/version, and run production acceptance when authorized. Produces standalone .fc/artifact plus syfo.yaml; never s.yaml. Use syfo-webdev-static only when all behavior is build-time or browser-only."
---

# Syfo WebDev Fullstack for FC and TiDB

Produce a Next.js application that Syfo can deploy deterministically to Alibaba Cloud Function Compute 3.0 and connect to TiDB Cloud Starter or Essential.

The output is not ready merely because `next build` passes. Prove that the assembled standalone artifact starts on `0.0.0.0:$PORT`, passes health and representative HTTP checks, uses TiDB-compatible migrations, avoids secret leakage, and satisfies the `syfo.yaml` contract.

## Completion contract

This skill owns the Syfo Hosted App lifecycle, not only source generation, database migration, or FC packaging. A successful `next build`, artifact assembly, or local smoke test is not task completion when the user asked to publish, deploy, go live, 上线, or provide a working Hosted App URL.

At the start, classify the requested scope so the workflow applies the correct deployment boundary:

- `build_only`: implement or repair the App and run relevant local checks; the user did not ask for Syfo deployment preparation.
- `deploy_ready`: complete local validation and immutable source preparation, but do not invoke paid/cloud mutation because deployment was not authorized.
- `deploy_authorized`: the user explicitly asked to deploy, publish, go live, 上线, or otherwise make the Syfo App accessible. Continue through the deployment workflow below.

For `deploy_ready` and `deploy_authorized`, read `references/deployment-lifecycle.md` and follow its
ownership, confirmation, failure-stage, and completion state machine. In particular, `owner=null`
is a valid draft and `syfo app claim` is not a routine pre-deploy step.

For `deploy_authorized`, finish the icon/npm gates below, pass the Builder-compatible artifact budget
gate, run `syfo app validate --json`, prove required database migrations through
`syfo app dev -- <command>` when applicable, push a clean immutable commit, prepare the
human-confirmed deploy, poll to a terminal version, and run production acceptance. For `build_only`
or `deploy_ready`, do not silently deploy; report the immutable source identity, local result, and
exact remaining state-machine step.

## Boundaries

- Read repository instructions before changing files. Project rules override this skill.
- Create or modify application code and the Syfo application declaration.
- Treat `syfo.yaml` as the application-to-Syfo contract. Syfo owns cloud resource IDs, credentials, domains, certificates, and generated FC infrastructure.
- Do not generate or maintain provider-specific `s.yaml`. Syfo backend services translate accepted `syfo.yaml` intent into provider deployment configuration.
- Never create or deploy paid cloud resources without explicit authorization.
- Never print or persist Alibaba Cloud, TiDB Cloud, DNS, certificate, Cookie, or application secret values.
- Verify region-sensitive FC runtime availability and version-sensitive TiDB behavior against current official documentation.

## Supported target

Before initialization, establish at least one current request-time server capability that requires
fullstack, such as SSR, server routes/actions, application authentication, server-only secrets,
runtime personalization, or durable writes/database access.

- Do not choose fullstack only for possible future expansion.
- If the stated requirements are entirely build-time or browser-only, use `syfo-webdev-static`.
- If the user names fullstack but provides no server requirement, point out the architecture cost
  and ask whether an unstated server capability exists before initializing.
- If the answer is ambiguous and changes the template, ask the user rather than guessing.

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
10. A passing Builder-compatible artifact budget report for the final `.fc/artifact`.

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

### 1A. Initialize the Hosted App repository correctly

Choose the init path before writing substantial application code:

- For a brand-new Syfo Hosted App, use the platform-created GitLab template repository. The
  platform creates the app repository from `syfo_hosted_app/app-templates/web-fullstack`
  (`nextjs` is a compatibility alias for `fullstack`). In the daemon CLI, run
  `syfo app init <name> --template fullstack --from-template --clone <dir>` and then work
  in `<dir>`. Do not recreate the scaffold from a checked-in docs copy.
- The daemon CLI owns the authenticated Git clone for `--from-template`. Do not run a separate
  `git clone`, reconstruct the repository URL, or copy a template by hand. Treat initialization
  as complete only after the command reports `app initialized` and returns a non-empty `cloneDir`
  plus the local binding path. Then `cd <cloneDir>` and inspect the template before changing it.
- An initialized App may report `owner=null`. Continue implementation and validation; do not insert
  `syfo app claim` unless the user explicitly wants ownership established before deployment or the
  CLI returns a specific ownership-required result.
- If initialization reports that the outcome is not yet known and returns a `commandId` or
  `resumeCommand`, run the exact `syfo app init --resume <commandId>` command. Do not rerun the
  original init command with a new idempotency key, choose another clone directory, manually
  clone the repository, or overwrite a partial clone. Resume replays the original request and
  either completes or reuses the exact clone; it fails closed if backend identity, local source,
  or clone state drifted. Keep the recovery state until both the API and local Git sync succeed.
- For an existing local Git project, commit a clean first version, then run `syfo app init
  <name> --template fullstack` from that repository without `--from-template`. The daemon sends `sourceMode=local`,
  so the platform creates an empty GitLab repository and the daemon pushes the local branch
  into it.
- Do not push an existing local repository into a template-initialized remote. That creates
  unrelated-history or non-fast-forward conflicts. If this has already happened, stop and
  resolve the Git history intentionally rather than force-pushing over the template baseline.

### 1B. Bind database-backed development to the allocated App TiDB

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

### 2A. Create the App icon before first deployment

Treat the favicon as product identity, not template residue. Before the first `syfo app validate` or deployment preparation:

1. Use the current App name and description to choose a distinctive, simple visual metaphor. Do not reuse a generic letter tile, framework logo, Syfo logo, or another App's icon.
2. Draw the icon as source-controlled SVG with a shared `viewBox="0 0 512 512"`, a strong silhouette, and enough contrast to remain legible at 16×16.
3. Create `public/syfo-app-icon.svg` as the canonical 512×512 source consumed by Syfo App cards before deployment, plus `public/favicon-16.svg`, `public/favicon-32.svg`, and `public/app-icon-180.svg`.
4. Render those SVG sources to valid RGBA/RGB PNGs in the root `app/` or `src/app/` directory using Next's native file convention: `icon1.png` = 16, `icon2.png` = 32, `icon3.png` = 180, and `icon4.png` = 512. Remove competing `favicon.ico`, SVG file-convention icons, unnumbered `icon.*`, extra numbered icons, and `apple-icon.*`; Next emits real per-size browser metadata from the PNG dimensions without parsing application TypeScript.
5. Keep every SVG a regular source-controlled file, self-contained, valid UTF-8, and at most 64 KiB. Require an unprefixed root `<svg xmlns="http://www.w3.org/2000/svg">`; forbid all entities/escapes, `<style>`/`style=`, DTD, scripts, event handlers, `foreignObject`, SMIL mutation elements (`set`/`animate*`), external CSS/resources, secrets, user-uploaded markup, and unlicensed logos. `href`, `src`, and `xlink:href` may reference only a local `#fragment`.
6. Render or inspect the design at 16, 32, 180, and 512 pixels. Simplify small variants instead of merely scaling details that disappear.

The skill doctor treats missing, unsafe, non-regular, incorrectly sized, conflicting, invalid-PNG, or unwired App icons as errors. After icon creation, run the doctor again and record zero icon errors before `syfo app validate` or deployment preparation.

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

For Next.js, set `output: "standalone"`. Assemble `.next/standalone`, `.next/static`, and `public` into the immutable `.fc/artifact` accepted by Syfo.

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
- `package-lock.json` with `npm ci` and an exact `packageManager: npm@10.x.y` for new official-template Apps. Generate and validate the lock with that npm 10 version because the Node 20 Builder does not accept npm 11-only lock resolution. Preserve another package manager only when its single lock file and every manifest command remain consistent.
- `npm run build`, whose project script runs `next build` and assembles `.fc/artifact`.
- `.fc/artifact` as `build.output` and `node server.js` as the foreground command inside it.
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

Immediately after assembly, enforce the same runtime-tree limits used by Builder:

```bash
node <skill-path>/scripts/check-artifact-budget.mjs --artifact .fc/artifact
```

The gate fails when the tree exceeds 70 MiB, a single file exceeds 70 MiB, the artifact has more
than 100,000 files, or the tree contains unsupported file types. Its Top dependency report and
hints identify common causes such as TypeScript/ESLint/Prettier in the runtime tree or simultaneous
glibc and musl Sharp packages. Do not delete dependencies blindly or increase the limit: rebuild
for the Linux FC target and prune only build-time or non-target packages from the assembled
artifact. The final doctor run repeats this gate when `.fc/artifact/server.js` exists.

### 9. Validate locally in layers

Read `references/local-validation.md` and execute the highest available tier.

Required local attempts without cloud credentials follow the resource-constrained retry and `not_run` rules in `references/local-validation.md`:

1. Frozen clean dependency install. For npm, first pass `npx --yes npm@<package.json packageManager version> ci --ignore-scripts --dry-run`, then run the real clean install with that same exact npm 10 version.
2. Project-provided lint, typecheck, unit, and integration tests for the touched surface.
3. Production Next.js build.
4. Standalone artifact assembly and content verification.
5. Builder-compatible artifact budget check with zero violations.
6. Artifact start with `HOSTNAME=0.0.0.0` and `PORT=9000`.
7. `/healthz`, home page, representative public route, and key API smoke checks.
8. Secret and forbidden-platform-reference scan.
9. `syfo.yaml` consistency review.

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

After an authorized deployment, read `app.visibility` with `syfo app status --json`. Never modify
the policy: App initialization supplies the default and only a human may change it in the Hosted App
management UI. If it conflicts with the requested audience, stop for the human change, then re-read
status. Run the matching cloud smoke only when the policy is `public` or when the human explicitly
supplies Basic Auth test credentials. Pass credentials only through environment variables so they do
not appear in shell history or the JSON report:

```bash
node <skill-path>/scripts/smoke-cloud-access.mjs \
  --url https://APP_DOMAIN \
  --mode public \
  --path /

SYFO_BASIC_AUTH_USERNAME=... SYFO_BASIC_AUTH_PASSWORD=... \
node <skill-path>/scripts/smoke-cloud-access.mjs \
  --url https://APP_DOMAIN \
  --mode basic_auth \
  --path /
```

### 10. Complete deployment or prepare Syfo handoff

- Validate `syfo.yaml` as application intent rather than cloud infrastructure.
- Do not add region, function name, domain, certificate, account ID, AccessKey, provider runtime identifiers, or Serverless Devs access configuration.
- Record the artifact entry, required application-owned environment-variable names, source revision, and validation results.
- Record `requestedScope` as `build_only`, `deploy_ready`, or `deploy_authorized`.
- For `deploy_authorized`, execute the Completion contract through human confirmation, terminal deployment state, version verification, and cloud acceptance. Do not merely hand the artifact to the backend and stop.
- For other scopes, hand the accepted manifest and immutable source/artifact identity to the Syfo backend deployment service and list the exact remaining deployment steps.
- When the delivery Artifact source is a directory, archive it first (for example `.tar.gz`) and
  declare/upload the regular archive file. A directory-upload rejection plus a local card is not a
  successful remote delivery.

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
- Record the read-only access policy from `syfo app status --json`; never call `syfo app access set`.
- For `public`, verify anonymous success. For Basic Auth, verify the anonymous challenge and
  authorized success only when a human explicitly supplies a test credential. For login/org policies,
  run the authorized browser flow only when the required human session is available; otherwise report
  the acceptance gap without weakening or changing the policy.

## Required handoff

Return a concise human-readable result in the user's language. Do not append raw CLI JSON or an internal audit object by default. Fields such as `skill`, `skillInvoked`, `requestedScope`, and a full `passed`/`not_run` matrix are implementation evidence, not user-facing deployment output.

For a completed authorized deployment, report:

- The live URL first.
- The deployed version and immutable source revision, confirming whether they match.
- The important cloud, authentication, and database checks that actually ran, summarized in one sentence.
- Known gaps or follow-up work only when they exist.

For a deployment waiting on human confirmation or still building, state the current stage and the concrete next action. Do not describe a prepared confirmation card as deployed.

For `build_only` or `deploy_ready`, state clearly that no cloud deployment was performed, record the immutable source identity and local validation outcome, and list the exact remaining deployment steps.

Keep command JSON and the detailed validation matrix as working evidence. If the user or an automation consumer explicitly requests structured output, write a secret-free `deployment-report.json` artifact or provide a compact JSON object on request instead of placing it in every chat response.

Never report a check as passed unless it was executed. Always distinguish local readiness from backend/cloud acceptance, and report pending or failed deployment state accurately.

## Stop conditions

Stop and ask rather than guessing when:

- Multiple application roots are plausible.
- Target region or runtime packaging mode changes the deployment design.
- A destructive database migration is required.
- The application needs an undeclared external service.
- Required Secrets or business acceptance scenarios cannot be determined.
- Native dependencies cannot be validated for the target Linux architecture.
- The app cannot run statelessly or within FC request/runtime limits.
