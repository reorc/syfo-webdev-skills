---
name: syfo-webdev-static
description: "Legacy compatibility Skill only for maintaining an existing historical Syfo static App. Trigger when the repository has legacy static markers such as the static export adapter, run.command node server.mjs, and no template.id: web-unified, or when the user explicitly names syfo-webdev-static/legacy static for an existing App. Preserve its directory, template, database=false contract, and deployment flow. Do not use for any new website or App; all new Syfo creation routes to syfo-webdev. Do not auto-trigger for generic website/webpage requests, standalone HTML, local preview, another provider, an existing unified repository, or uncertain legacy classification. If delivery target or repository type is unclear, ask the user before any Syfo CLI action. Never silently migrate, enable a database, deploy, or change access policy."
---

# Syfo WebDev Static for FC

This is a legacy compatibility entry. Preserve the old static repository and flow. A request for APIs, login, or persistence is not consent to migrate or enable TiDB; route upgrade planning to `syfo-webdev` and require separate explicit human authorization.

Produce a static Next.js application that Syfo can deploy deterministically to Alibaba Cloud Function Compute 3.0 without application backend logic or a database.

The site is static at the product layer. A small Node.js HTTP adapter exists only because FC requires a foreground HTTP process; it serves exported files, health checks, correct 404 responses, cache headers, byte ranges for media, and delegates platform Basic Auth policy checks. It must not contain business APIs, application-owned authentication, user credentials, persistence, or request-time rendering.

## Completion contract

This skill owns the Syfo Hosted App lifecycle, not only source generation or FC packaging. A successful `next build`, artifact assembly, or local smoke test is not task completion when the user asked to publish, deploy, go live, 上线, or provide a working Hosted App URL.

Before running any Syfo CLI command, resolve the delivery target explicitly:

- `local_html`: the user wants an HTML file or local preview only. Do not initialize, validate, package, or deploy a Syfo App; provide the requested local artifact instead.
- `syfo_hosted_app`: continue here only when an existing App is positively identified as legacy static. Route every new Syfo website/App to `syfo-webdev`. If an existing App's template type is unclear, ask the user or use the unified read-only classifier before any mutation.
- `unknown`: the user asks for a website/webpage but does not identify a hosting target or the legacy markers conflict. Ask the minimum question needed to confirm local HTML vs Syfo hosting and, for an existing Syfo App, its authoritative template type. Do not choose a template or run Syfo commands meanwhile.

“Please send me the HTML” means `local_html` unless the user separately requests Syfo hosting or deployment.

At the start, classify the requested scope so the workflow applies the correct deployment boundary:

- `build_only`: implement or repair the App and run relevant local checks; the user did not ask for Syfo deployment preparation.
- `deploy_ready`: complete local validation and immutable source preparation, but do not invoke paid/cloud mutation because deployment was not authorized.
- `deploy_authorized`: the user explicitly asked to deploy, publish, go live, 上线, or otherwise make the Syfo App accessible. Continue through the deployment workflow below.

For `deploy_ready` and `deploy_authorized`, read `references/deployment-lifecycle.md` and follow its
ownership, confirmation, failure-stage, and completion state machine. In particular, `owner=null`
is a valid draft and `syfo app claim` is not a routine pre-deploy step.

For `deploy_authorized`, finish the icon/npm gates below, run `syfo app validate --json`, push a
clean immutable commit, prepare the human-confirmed deploy, poll to a terminal version, and run
access-aware cloud smoke. For `build_only` or `deploy_ready`, do not silently deploy; report the
immutable source identity, local result, and exact remaining state-machine step.

## Boundaries

- Read repository instructions before changing files. Project rules override this skill.
- Treat `syfo.yaml` as the application-to-Syfo contract.
- Do not generate or maintain provider-specific `s.yaml`; Syfo backend services own the `syfo.yaml` to `s.yaml` translation and FC infrastructure.
- Do not add TiDB, another database, server sessions, server secrets, API routes, webhooks, queues, cron jobs, or runtime file writes.
- Do not silently weaken a server-side requirement into insecure browser code.
- Never deploy paid cloud resources without explicit authorization.
- Verify version-sensitive Next.js static-export behavior against current official documentation.

## Eligibility gate

Before initialization, record a concise capability decision based on current requirements, not
speculative future expansion:

- Use static by default when no request-time server capability is required.
- “We may need a backend later” is not sufficient reason to initialize fullstack now.
- If the user names fullstack but the stated requirements are entirely build-time or browser-only,
  point out the mismatch and ask whether there is an unstated server requirement before initializing.
- If a requirement is ambiguous and the answer changes the template, ask the user rather than
  guessing. Keep the question focused on the missing capability, such as authentication, secrets,
  runtime APIs, request-time rendering, or durable writes.

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

### 2. Verify the existing historical App binding

This legacy Skill may continue only when all of the following are already true:

- The working directory is an existing Git repository for an existing Syfo App, not a project being converted into one.
- `syfo.yaml` and the runtime files positively identify the historical static contract: no `template.id: web-unified`, `run.command: node server.mjs`, and `database.required: false`.
- Existing App identity or local binding evidence matches this repository. Never create a replacement App, remote, clone, or binding from this Skill.

If the repository is new, has no existing Syfo App/binding, contains unified markers, or has missing/conflicting legacy markers, stop before editing or running Syfo CLI. Route new creation to `syfo-webdev`; for uncertain existing repositories, use its read-only classifier and ask the user for the authoritative App/repository identity.

An existing historical App may have `owner=null`. That is a valid draft state; do not insert `syfo app claim` unless the user explicitly requests ownership or the server returns a specific ownership-required result.

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

### 3A. Create the App icon before first deployment

Treat the favicon as product identity, not template residue. Before the first `syfo app validate` or deployment preparation:

1. Use the current App name and description to choose a distinctive, simple visual metaphor. Do not reuse a generic letter tile, framework logo, Syfo logo, or another App's icon.
2. Draw the icon as source-controlled SVG with a shared `viewBox="0 0 512 512"`, a strong silhouette, and enough contrast to remain legible at 16×16.
3. Create `public/syfo-app-icon.svg` as the canonical 512×512 source consumed by Syfo App cards before deployment, plus `public/favicon-16.svg`, `public/favicon-32.svg`, and `public/app-icon-180.svg`.
4. Render those SVG sources to valid RGBA/RGB PNGs in the root `app/` or `src/app/` directory using Next's native file convention: `icon1.png` = 16, `icon2.png` = 32, `icon3.png` = 180, and `icon4.png` = 512. Remove competing `favicon.ico`, SVG file-convention icons, unnumbered `icon.*`, extra numbered icons, and `apple-icon.*`; Next emits real per-size browser metadata from the PNG dimensions without parsing application TypeScript.
5. Keep every SVG a regular source-controlled file, self-contained, valid UTF-8, and at most 64 KiB. Require an unprefixed root `<svg xmlns="http://www.w3.org/2000/svg">`; forbid all entities/escapes, `<style>`/`style=`, DTD, scripts, event handlers, `foreignObject`, SMIL mutation elements (`set`/`animate*`), external CSS/resources, secrets, user-uploaded markup, and unlicensed logos. `href`, `src`, and `xlink:href` may reference only a local `#fragment`.
6. Render or inspect the design at 16, 32, 180, and 512 pixels. Simplify small variants instead of merely scaling details that disappear.

The skill doctor treats missing, unsafe, non-regular, incorrectly sized, conflicting, invalid-PNG, or unwired App icons as errors. After icon creation, run the doctor again and record zero icon errors before `syfo app validate` or deployment preparation.

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
- `package-lock.json` with `npm ci` and an exact `packageManager: npm@10.x.y` when the existing historical repository originated from the official legacy template. Generate and validate the lock with that npm 10 version because the Node 20 Builder does not accept npm 11-only lock resolution. Preserve another package manager only when its single lock file and every manifest command remain consistent.
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

Required local attempts without cloud credentials follow the resource-constrained retry and `not_run` rules in `references/local-validation.md`:

1. Frozen clean dependency install. For npm, first pass `npx --yes npm@<package.json packageManager version> ci --ignore-scripts --dry-run`, then run the real clean install with that same exact npm 10 version.
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

The harness starts a loopback public verifier and injects temporary platform verifier variables, so
home and 404 checks exercise the production fail-closed adapter without cloud credentials. Do not
start `server.mjs` directly and interpret its expected credential-less 503 as an App failure.

For responsive browser evidence, prefer browser automation with an explicit viewport instead of
manually resizing Chrome. Capture at least one desktop viewport (for example 1440×900) and one
mobile viewport (for example 390×844), plus direct navigation and console results. Use Computer Use
when interaction requires the real desktop, but never mark mobile validation passed from source
inspection alone.

For Apple Silicon development or architecture-specific dependencies, validate the assembled artifact in Linux AMD64 even though the application itself is static.

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

### 11. Complete deployment or prepare Syfo handoff

- Record the verified artifact entry, source revision or ZIP digest, artifact digest, asset budget, public environment-variable names, and validation results.
- Record `requestedScope` as `build_only`, `deploy_ready`, or `deploy_authorized`.
- For `deploy_authorized`, execute the Completion contract through human confirmation, terminal deployment state, version verification, and cloud smoke. Do not merely hand the artifact to the backend and stop.
- For other scopes, hand `syfo.yaml` plus immutable source/artifact identity to the Syfo backend deployment service and list the exact remaining deployment steps.
- When the delivery Artifact source is a directory, archive it first (for example `.tar.gz`) and
  declare/upload the regular archive file. A directory-upload rejection plus a local card is not a
  successful remote delivery.
- Do not generate `s.yaml` or perform cloud resource creation from this skill.
- Distinguish local readiness from backend/cloud acceptance.
- Read and report the policy from `syfo app status --json`; never call `syfo app access set`.
- For `public`, verify anonymous success. For Basic Auth, verify the anonymous challenge and
  authorized success only when a human explicitly supplies a test credential. If the required
  credential is unavailable, report the acceptance gap without weakening or changing the policy.

## Required handoff

Return a concise human-readable result in the user's language. Do not append raw CLI JSON or an internal audit object by default. Fields such as `skill`, `skillInvoked`, `requestedScope`, and a full `passed`/`not_run` matrix are implementation evidence, not user-facing deployment output.

For a completed authorized deployment, report:

- The live URL first.
- The deployed version and immutable source revision, confirming whether they match.
- The important cloud checks that actually ran, summarized in one sentence.
- Known gaps or follow-up work only when they exist.

For a deployment waiting on human confirmation or still building, state the current stage and the concrete next action. Do not describe a prepared confirmation card as deployed.

For `build_only` or `deploy_ready`, state clearly that no cloud deployment was performed, record the immutable source identity and local validation outcome, and list the exact remaining deployment steps.

Keep command JSON and the detailed validation matrix as working evidence. If the user or an automation consumer explicitly requests structured output, write a secret-free `deployment-report.json` artifact or provide a compact JSON object on request instead of placing it in every chat response.

Never report a check as passed unless it was executed. Always distinguish local readiness from backend/cloud acceptance, and report pending or failed deployment state accurately.

## Stop conditions

Stop and ask rather than guessing when:

- Multiple application roots are plausible.
- A requested feature requires server-side identity, secrets, authorization, persistence, or request-time rendering.
- The accepted `syfo.yaml` version differs from the bundled baseline.
- Artifact size or file count may exceed the Syfo/FC delivery limit.
- Media must move to an object store but no approved storage contract exists.
- Dynamic routes cannot be fully enumerated at build time.
- Native dependencies cannot be validated for the target Linux architecture.
