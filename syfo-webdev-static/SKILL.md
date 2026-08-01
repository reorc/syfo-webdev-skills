---
name: syfo-webdev-static
description: "Use whenever a user asks to create, build, continue, fix, migrate, validate, package, publish, deploy, or take live a static Syfo App or Syfo Hosted App. Trigger without being named when the request or repository indicates Syfo hosting, including website, Hosted App, 上线, 部署, syfo.yaml, syfo app init, syfo app validate, or syfo app deploy. Covers landing pages, marketing sites, docs, portfolios, blogs, showcases, and browser-only Next.js App Router experiences fully generated at build time. Own the full lifecycle: choose/init the template or bind an existing repo, implement, validate, create and push immutable source, prepare the human-confirmed deploy, check status/version, and run access-aware production smoke when authorized. Produces output: export, .fc/artifact with static adapter, /healthz, and syfo.yaml; never s.yaml. Route cookies, application auth, server routes/actions, secrets, ISR, writes, and database requirements to syfo-webdev-fullstack."
---

# Syfo WebDev Static for FC

Produce a static Next.js application that Syfo can deploy deterministically to Alibaba Cloud Function Compute 3.0 without application backend logic or a database.

The site is static at the product layer. A small Node.js HTTP adapter exists only because FC requires a foreground HTTP process; it serves exported files, health checks, correct 404 responses, cache headers, byte ranges for media, and delegates platform Basic Auth policy checks. It must not contain business APIs, application-owned authentication, user credentials, persistence, or request-time rendering.

## Completion contract

This skill owns the Syfo Hosted App lifecycle, not only source generation or FC packaging. A successful `next build`, artifact assembly, or local smoke test is not task completion when the user asked to publish, deploy, go live, 上线, or provide a working Hosted App URL.

At the start, classify the requested scope and keep it visible in the handoff:

- `build_only`: implement or repair the App and run relevant local checks; the user did not ask for Syfo deployment preparation.
- `deploy_ready`: complete local validation and immutable source preparation, but do not invoke paid/cloud mutation because deployment was not authorized.
- `deploy_authorized`: the user explicitly asked to deploy, publish, go live, 上线, or otherwise make the Syfo App accessible. Continue through the deployment workflow below.

For `deploy_authorized`, do not stop after coding or local validation:

1. Run `syfo app validate --json` in the bound App repository and resolve failures.
2. Require a clean immutable commit, then push it with `syfo app push` or the repository-approved Git path. Never deploy an uncommitted working tree.
3. Run `syfo app deploy --json` from the bound repository; pass an App ID only when no binding is available. This prepares a billing/human-confirmed deployment rather than completing it immediately.
4. Report the returned deploy/confirmation identifiers and clearly state that the human confirmation card is pending when it has not been approved. A prepared card is progress, not a successful deployment.
5. After confirmation, poll `syfo app status --json` and `syfo app versions --json` until a terminal state is available. Do not claim success while state is queued, pending confirmation, building, or deploying.
6. Run `syfo app open --json` to obtain the deployed URL, then run the access-aware cloud smoke for the configured policy.
7. Mark deployment complete only when the deployed version matches the intended commit and required cloud smoke passes.

For `build_only` or `deploy_ready`, do not silently deploy. State the exact remaining `syfo app validate`, source push, `syfo app deploy`, confirmation, status/version, and smoke steps; cloud acceptance stays `not_run`.

## Boundaries

- Read repository instructions before changing files. Project rules override this skill.
- Treat `syfo.yaml` as the application-to-Syfo contract.
- Do not generate or maintain provider-specific `s.yaml`; Syfo backend services own the `syfo.yaml` to `s.yaml` translation and FC infrastructure.
- Do not add TiDB, another database, server sessions, server secrets, API routes, webhooks, queues, cron jobs, or runtime file writes.
- Do not silently weaken a server-side requirement into insecure browser code.
- Never deploy paid cloud resources without explicit authorization.
- Verify version-sensitive Next.js static-export behavior against current official documentation.

## Eligibility gate

Stay static when every required behavior is available at build time or in the browser:

- Marketing, product, documentation, portfolio, campaign, showcase, and content sites.
- Blogs and dynamic routes whose complete parameter set is known during the build.
- Client-side state, local storage, and calls to explicitly approved public APIs.
- Forms submitted directly to an approved external service without private credentials.
- Source-controlled images, audio, video, downloads, and fonts that fit the deployment artifact budget.

Stop and use `syfo-webdev-fullstack` when the request needs:

- Cookies, server-side sessions, application-owned authentication or authorization, or private user data. Platform-managed Hosted App Basic Auth remains an infrastructure access policy and is supported by the adapter.
- Server Actions or request-dependent Route Handlers.
- Server-only secrets or private upstream credentials.
- A database, upload backend, webhook, queue, scheduled job, or durable write.
- ISR or content that must update without a new build and deployment.
- Request headers, geolocation, tenant routing, or request-time personalization.

Explain the blocker and the smallest viable fullstack alternative instead of moving secrets or authorization into browser code.

## Required outputs

Deliver all applicable items:

1. Complete Next.js source code and one matching dependency lock file.
2. `output: "export"` and a successful `out/` build.
3. Project-local static artifact assembly and server adapter files based on the bundled templates.
4. An immutable `.fc/artifact` containing `public/` plus `server.mjs`.
5. `GET /healthz`, provided by the static adapter without application writes or dependencies.
6. `syfo.yaml` version 1 at the selected `appDir` root.
7. Local validation commands and machine-readable results.
8. Frontend capability selection and browser-quality evidence when user-visible UI is created or materially changed.
9. An immutable Git commit SHA or ZIP SHA-256 for final handoff.

## Workflow

### 1. Resolve the application root

- Inspect the repository, package manager, workspace layout, Next.js version, router mode, design system, test commands, and current deployment configuration.
- Select one explicit `appDir`; do not guess between multiple plausible applications.
- For an existing plain HTML or React/Vite site, preserve information architecture and assets while migrating it to a Next.js App Router static export only when the user requested Next.js.
- Inventory source-controlled media by total bytes, file count, largest files, and required HTTP Range behavior.

Run the bundled audit from the selected application root:

```bash
node <skill-path>/scripts/doctor.mjs --json
```

Treat findings as a review queue, not an automatic rewrite plan.

### 2. Initialize the Hosted App repository correctly

Choose the init path before writing substantial site code:

- For a brand-new Syfo Hosted App, use the platform-created GitLab template repository. The
  platform creates the app repository from `syfo_hosted_app/app-templates/web-static`.
  In the daemon CLI, run `syfo app init <name> --template static --from-template --clone <dir>`
  and then work in `<dir>`. Do not recreate the scaffold from a checked-in docs copy.
- The daemon CLI owns the authenticated Git clone for `--from-template`. Do not run a separate
  `git clone`, reconstruct the repository URL, or copy a template by hand. Treat initialization
  as complete only after the command reports `app initialized` and returns a non-empty `cloneDir`
  plus the local binding path. Then `cd <cloneDir>` and inspect the template before changing it.
- If initialization reports that the outcome is not yet known and returns a `commandId` or
  `resumeCommand`, run the exact `syfo app init --resume <commandId>` command. Do not rerun the
  original init command with a new idempotency key, choose another clone directory, manually
  clone the repository, or overwrite a partial clone. Resume replays the original request and
  either completes or reuses the exact clone; it fails closed if backend identity, local source,
  or clone state drifted. Keep the recovery state until both the API and local Git sync succeed.
- For an existing local Git project, commit a clean first version, then run `syfo app init
  <name> --template static` from that repository without `--from-template`. The daemon sends `sourceMode=local`, so
  the platform creates an empty GitLab repository and the daemon pushes the local branch into it.
- Do not push an existing local repository into a template-initialized remote. That creates
  unrelated-history or non-fast-forward conflicts. If this has already happened, stop and
  resolve the Git history intentionally rather than force-pushing over the template baseline.

### 3. Pass the frontend capability gate

Classify the user-visible scope as `none`, `preserve`, `new_ui`, or `material_change`.

For `new_ui` or `material_change`:

1. Inspect the frontend, design, UX, accessibility, responsive, and browser-validation skills available in the current agent environment.
2. Select the smallest appropriate capability set. Do not require a specific named skill.
3. State the selected capabilities, design rationale, and browser-validation plan before implementing UI.
4. Follow the selected capability's project-context and design workflow.
5. Validate the final interface by outcomes and browser evidence rather than skill identity.

For `none` or `preserve`, record why no design workflow is required. Do not redesign a static site during a packaging-only migration.

Read `references/frontend-capability.md` before creating or materially changing pages, navigation, forms, onboarding, empty states, or other user-visible UI.

### 4. Prove static eligibility

Search for request-time or server-only behavior, including:

```text
cookies(
headers(
draftMode(
"use server"
middleware.ts
proxy.ts
app/**/route.ts
export const revalidate
export const runtime
database drivers and ORMs
```

Also inspect dynamic routes, `next/image`, environment variables, runtime fetches, generated metadata, redirects, and third-party packages.

Classify each finding as:

- Build-time compatible.
- Browser-only compatible and safe to expose publicly.
- Requires a product or architecture change.
- Requires `syfo-webdev-fullstack`.

Read `references/static-export.md` before deciding that a route is exportable.

### 5. Configure Next.js static export

Preserve unrelated configuration and add the minimum static settings:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

Only add `images.unoptimized` when the project uses `next/image` without an approved custom loader. Do not add it reflexively.

For dynamic segments, generate every deployable route with `generateStaticParams()`. Unknown paths must keep real 404 behavior unless the product explicitly requires SPA fallback.

### 6. Implement the static experience

- Establish global layout and navigation before isolated pages.
- Reuse the existing design system, components, and semantic tokens.
- Keep browser-visible environment values limited to public, non-secret configuration.
- Provide loading, empty, error, and success states for browser-side interactions.
- Preserve accessibility, keyboard navigation, focus visibility, contrast, responsive layout, and reduced-motion behavior.
- Avoid placeholder routes, dead ends, nested anchors, invalid interactive nesting, and console errors.

Read `references/frontend-quality.md` for the completion checklist.

### 7. Handle assets and media deliberately

- Keep normal source-controlled assets in `public/` when their size, licensing, and deployment budget are acceptable.
- Do not copy the reference skill's Manus-specific upload commands or storage paths.
- For large or frequently changing media, use an approved object store only with user and platform agreement.
- Preserve correct MIME types and byte-range responses for audio and video.
- Treat media playback and seeking as acceptance scenarios when the project contains local media.

The example repository's static audio showcase is about 23 MB with hundreds of MP3 files. That is a valid source-controlled static shape, but it requires artifact-size review and Range-request smoke testing rather than an automatic ban on local media.

Read `references/assets-and-media.md` before moving or externalizing assets.

### 8. Add the FC static adapter

Copy the bundled project templates into the application:

```text
templates/project-assemble-static.mjs -> scripts/assemble-static.mjs
templates/project-static-server.mjs   -> scripts/static-server.mjs
```

The assembly script must:

- Fail when `out/` or the server template is missing.
- Recreate `.fc/artifact` deterministically.
- Copy `out/` to `.fc/artifact/public/`.
- Copy the server adapter to `.fc/artifact/server.mjs`.
- Report file count, byte size, server entry, and SHA-256 without including secrets.

The server adapter must:

- Listen on `0.0.0.0` and `process.env.PORT`, defaulting locally to 9000.
- Run in the foreground and exit non-zero on startup failure.
- Serve exported files without writes or application state.
- Provide unauthenticated `GET /healthz`.
- Delegate non-health visitor access checks to the Syfo Basic Auth verifier, fail closed when the verifier is unavailable, and never embed visitor passwords.
- Resolve the public root and served files through `realpath`, rejecting symlink escapes.
- Preserve generated HTML routing and real 404 behavior.
- Support `GET`, `HEAD`, and single byte ranges for media.
- Add immutable caching for `/_next/static/` and conservative caching elsewhere.
- Shut down cleanly on termination when practical.

Read `references/fc-static-runtime.md` before replacing the adapter.

### 9. Create `syfo.yaml`

Start from `templates/syfo.nextjs-static.yaml` and keep all paths relative to `appDir`.

The baseline declares:

- `app.type: nextjs`.
- Node.js runtime intent without provider runtime identifiers.
- `package-lock.json` with `npm ci` for new official-template Apps. Preserve another package manager only when its single lock file and every manifest command remain consistent.
- `npm run build`, whose project-owned build script performs `next build` and artifact assembly; do not put compound shell commands in `syfo.yaml`.
- `.fc/artifact` as the build output.
- `node server.mjs` as the foreground command inside the artifact.
- Port 9000 and `/healthz`.
- `database.required: false` and no TiDB environment variables.
- Only public application-owned environment-variable names when truly required.
- Public `GET`, `HEAD`, and `OPTIONS` routing without SPA fallback.

Never include region, function name, account ID, domain, certificate, AccessKey, provider runtime name, connection string, or secret value. Syfo backend services generate the provider deployment configuration.

Read `references/syfo-contract.md` for rejection conditions.

### 10. Validate locally in layers

Run the highest available tier from `references/local-validation.md`.

Mandatory without cloud credentials:

1. Frozen clean dependency install.
2. Project-provided lint, typecheck, and tests.
3. Production static export build.
4. Artifact assembly and content verification.
5. Artifact start on `0.0.0.0:9000`.
6. `/healthz`, home, representative nested paths, static assets, and 404 checks.
7. Audio/video Range checks when media exists.
8. Browser checks for direct navigation, hydration, console errors, responsive layout, accessibility basics, and media playback.
9. Secret, server-only API, database dependency, and forbidden provider-reference scans.
10. `syfo.yaml` consistency review.

When frontend scope is `new_ui` or `material_change`, browser validation must also prove the selected design direction, desktop and mobile layouts, keyboard operation, interactive states, and absence of unintended default controls or scaffold placeholders.

Do not mark frontend or browser validation as `passed` from source inspection or build output alone.

Run the reusable smoke harness as:

```bash
node <skill-path>/scripts/smoke-static.mjs \
  --artifact .fc/artifact \
  --path / \
  --path /representative-page \
  --range-path /audio/representative.mp3
```

Omit `--range-path` when the site has no audio or video.

For Apple Silicon development or architecture-specific dependencies, validate the assembled artifact in Linux AMD64 even though the application itself is static.

After an authorized deployment, run the access-aware cloud smoke. Pass Basic Auth credentials only
through environment variables so they do not appear in shell history or the JSON report:

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

### 11. Complete deployment or prepare Syfo handoff

- Record the verified artifact entry, source revision or ZIP digest, artifact digest, asset budget, public environment-variable names, and validation results.
- Record `requestedScope` as `build_only`, `deploy_ready`, or `deploy_authorized`.
- For `deploy_authorized`, execute the Completion contract through human confirmation, terminal deployment state, version verification, and cloud smoke. Do not merely hand the artifact to the backend and stop.
- For other scopes, hand `syfo.yaml` plus immutable source/artifact identity to the Syfo backend deployment service and list the exact remaining deployment steps.
- Do not generate `s.yaml` or perform cloud resource creation from this skill.
- Distinguish local readiness from backend/cloud acceptance.
- After deployment, run access-aware smoke for the configured policy: public anonymous success;
  Basic Auth anonymous challenge; and Basic Auth success with an authorized test credential.

## Required handoff

Return a human-readable summary followed by exactly one JSON object:

```json
{
  "skill": "syfo-webdev-static",
  "requestedScope": "deploy_ready",
  "skillInvoked": true,
  "source": {
    "type": "git",
    "revision": "FULL_COMMIT_SHA",
    "sha256": null
  },
  "appDir": ".",
  "manifest": "syfo.yaml",
  "artifact": ".fc/artifact",
  "serverEntry": ".fc/artifact/server.mjs",
  "target": {
    "platform": "aliyun-fc3",
    "mode": "nextjs-static",
    "database": "none"
  },
  "requiredEnv": [],
  "deployment": {
    "validate": "passed",
    "sourcePush": "passed",
    "deployPrepared": "not_run",
    "humanConfirmation": "not_run",
    "deployState": "not_run",
    "version": null,
    "url": null
  },
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
    "directNavigation": "passed",
    "notFound": "passed",
    "rangeRequests": "not_applicable",
    "browser": "passed",
    "linuxAmd64": "not_applicable",
    "cloudPublicAnonymous": "not_run",
    "cloudBasicAuthChallenge": "not_run",
    "cloudBasicAuthAuthorized": "not_run",
    "cloudAcceptance": "not_run"
  },
  "notes": []
}
```

Use only `passed`, `failed`, `not_applicable`, or `not_run`. Never report `passed` for a command or scenario that was not executed.

## Stop conditions

Stop and ask rather than guessing when:

- Multiple application roots are plausible.
- A requested feature requires server-side identity, secrets, authorization, persistence, or request-time rendering.
- The accepted `syfo.yaml` version differs from the bundled baseline.
- Artifact size or file count may exceed the Syfo/FC delivery limit.
- Media must move to an object store but no approved storage contract exists.
- Dynamic routes cannot be fully enumerated at build time.
- Native dependencies cannot be validated for the target Linux architecture.
