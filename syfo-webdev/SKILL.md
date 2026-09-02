---
name: syfo-webdev
description: "Create and maintain Syfo-hosted websites using the web-unified contract, including binding recovery, optional cloud database enablement, validation, packaging, and authorized deployment. Treat 'Syfo Hosted App' as legacy hosting wording, never as database intent. For an unspecified new website target in a Syfo runtime, ask local/source-only versus Syfo hosting once. New Syfo websites default to no database; when persistence is required, ask one provider-neutral cloud-database consent question. Keep TiDB, app/tidb, preset=app, and --confirm-tidb internal. When an existing website's machine-local binding is missing, use syfo app bind <app-id> for the authoritative local repository or syfo app clone <app-id> --clone <dir> when no clone exists; never rerun syfo app init and never copy .git/syfo-hosted-app.json from another machine or Agent. Route historical static/fullstack contracts to legacy Skills. Never silently initialize, migrate, enable a database, deploy, or change access policy."
---

# Syfo WebDev Unified

Build, repair, validate, package, and—only when explicitly authorized—deploy a Syfo-hosted website based on the `web-unified` template.

Use **Syfo website**, **Syfo-hosted website**, or **Syfo Websites** in user-facing language. Call the optional persistence capability a **Syfo cloud database** or simply **cloud database**. `Hosted App`, `App`, `site`, `app`, `TiDB`, `site/none`, `app/tidb`, and `--confirm-tidb` are legacy, provider-specific, or internal contract terms. Do not teach, offer, or repeat those terms to the user unless the user explicitly names one, an existing identifier must be quoted, or a technical contract mismatch is being diagnosed. Even when the user says “TiDB,” describe the resulting user-facing capability as a cloud database while preserving the TiDB-compatible command internally.

## Activation boundary

Selection is based on delivery intent and recognized Syfo website contract evidence, not on the word “Syfo” alone.

Use this Skill when at least one positive signal exists:

1. The current application has a recognized Syfo website contract marker, including a valid `syfo.yaml`.
2. The user explicitly asks to create, host, validate, package, publish, or deploy the website through Syfo, explicitly requests a `syfo app` workflow, or uses the legacy phrase “Syfo Hosted App.”
3. The user explicitly names this Skill.
4. The daemon-injected runtime context identifies the agent as running in Syfo and the user asks to create a new website, web app, landing page, dashboard, or interactive browser experience without specifying a delivery target. In this case, use the Skill only as a routing gate until the target is resolved.

Do not activate merely because a repository, product, package, team, feature, organization, CLI, daemon, template, API, or infrastructure component is named Syfo or discusses internal hosted-app concepts. In an existing repository without a recognized website contract marker, requests such as “implement Syfo Web search” or “fix the Syfo website login” are ordinary product-development work unless the user separately selects Syfo hosting as the delivery target.

Consulting this Skill is not authorization to initialize, provision a cloud database, migrate, deploy, or change access policy.

## Delivery target and Skill relationship

For new website creation, resolve the target before implementation. For existing repositories, inspect contract markers before any Syfo CLI command:

- `local_html`: the user explicitly wants HTML/source only, a local preview, or another hosting provider. Exit the Syfo workflow and use the appropriate general web-development workflow. Do not initialize, validate, package, or deploy Syfo.
- `syfo_hosted_website`: all new websites hosted by Syfo use this unified Skill. Existing `template.id: web-unified` repositories also stay here. Positively identified historical static/fullstack repositories route to their matching legacy maintenance Skill without reinterpretation.
- `unknown`: a new website request does not specify local/source-only delivery, another provider, or Syfo hosting; or existing repository markers are missing/conflicting. Ask the minimum focused question and do not begin implementation, initialize, migrate, enable a database, or deploy meanwhile.

For an unspecified new website target, ask once in the user's language: “Do you want local/source-only delivery, or should I create and host it as a Syfo website?” A direct answer resolves this gate; do not repeatedly ask after the target is clear.

`syfo-webdev-static` and `syfo-webdev-fullstack` are compatibility aliases for historical Apps only. They never create a new website or App. “Please send me the HTML” means `local_html` unless the user separately requests Syfo hosting.

## Safety contract

- Read repository instructions before changing files.
- Treat `syfo.yaml` with `template.id: web-unified` as the deterministic unified marker.
- Preserve existing legacy static/fullstack repositories and route them to the matching legacy Skill.
- Never reinterpret an existing App as unified because a feature request mentions login, APIs, or a database.
- Never enable a cloud database, migrate a template, deploy, or change access policy without separate explicit human consent for that action.
- To keep access policy human-owned, never call `syfo app access set`.
- Do not generate provider-specific `s.yaml` or persist cloud credentials.

## Operational-status source gate

Apply this gate when a requested website presents Agent, runtime, deployment, platform, or other
operational status. Before initialization, implementation, or deployment, separate the requested
claims into these categories:

- **Point-in-time availability**: whether a deployed website can be reached now.
- **Continuous monitoring**: observations collected repeatedly over time.
- **Historical or activity status**: what an Agent, runtime, or deployment did or is doing.

List every displayed claim and its exact source. Verify that the source is available to the current
caller through a documented URL, API, CLI, event, or App-owned database contract, and state its
freshness and limitations. Preserve each business fact the human requested: do not replace a claim
with an easier proxy, collapse several claims into one generic status, or silently narrow the
requested product because one source is missing. Report the missing source for that specific claim.

For point-in-time website availability, directly request the deployed public domain and report the
checked URL, check time, and observed HTTP or page result. This is a valid source for the current
reachability claim, so do not block it merely because no monitoring feed exists. It does not prove
continuous uptime, history, Agent liveness, or Agent activity.

Continuous monitoring and historical or activity claims require a real source that can be consumed
repeatedly. If no such source is documented and accessible, disclose the missing capability and stop
before initializing, implementing, or deploying a page that would imply those claims. Never invent
a telemetry token, environment variable, API, permission path, role assignment, settings entry, or
sample data to fill the gap.

A row written explicitly by Agent or business code to the website's cloud database is only a
**best-effort active log**. Use it only when the participating code really writes it, and explain
that a missing or stale row does not prove that an Agent or runtime is up or down.

Treat structured status, authorization, and access results as authoritative. Preserve their
reported caller, capability, denial reason, required authorization, and documented executable entry
points without recreating a role matrix in this Skill. An access denial or login requirement does
not establish a missing telemetry credential or a new data source. If no verified executable path
is returned, report the boundary instead of inventing one.

When the human corrects a data-source, access, or capability assumption, invalidate the old
assumption immediately, re-read the authoritative facts, and restate the plan before another
mutation.

## Repository classification

Classify before any Syfo mutation:

1. **Unified**: `syfo.yaml` contains `template.id: web-unified`. Continue here and preserve its current preset/database state.
2. **Legacy static**: no unified marker, static export/adapter markers, `run.command: node server.mjs`, or `database.required: false` in the legacy static contract. Use `syfo-webdev-static` without rewriting the template.
3. **Legacy fullstack**: no unified marker, standalone legacy markers, `run.command: node server.js`, and `database.required: true`. Use `syfo-webdev-fullstack` without rewriting the template.
4. **Ambiguous**: missing or conflicting markers. Stop and ask; do not guess, initialize, migrate, enable a database, or deploy.

Detection is read-only. A classification result is not migration consent.

## New website create contract

All new Syfo-hosted websites use the unified template. Presets are internal daemon compatibility values, not user-facing website types:

- A website without a cloud database uses `template=unified`, `preset=site`; the daemon sends the complete Core pair `site/none`.
- A website with a cloud database currently uses `template=unified`, `preset=app`; the daemon sends the complete Core pair `app/tidb`.

When the user selects Syfo hosting without explicitly requesting or approving a database, default to the website-without-database path. Do not ask the user to choose “Site” versus “App,” and do not interpret the words “app,” “web app,” or the legacy phrase “Syfo Hosted App” as cloud-database consent. Never treat the legacy phrase “Syfo Hosted App” as TiDB consent.

If the requested functionality requires persistence, that requirement may trigger one focused consent question but does not itself authorize a cloud database. Ask in the user's language using provider-neutral wording, for example: “这个网站需要持久化保存数据。是否为它启用 Syfo 云数据库？” or “This website needs persistent data. Should I enable a Syfo cloud database for it?” An explicit request for a database, cloud database, or TiDB—or a yes after this disclosure—is the single informed confirmation, so do not ask again. In internal compatibility terms, an explicit TiDB request or a yes after this disclosure is the single informed confirmation. Include the internal `--confirm-tidb` flag only after that confirmation; the flag records consent for the daemon and never requires a second confirmation prompt.

Use the corresponding preset-only CLI exactly; `--database` is not a user-facing init flag:

```bash
syfo app init <name> --template unified --preset site --from-template --clone <dir>
syfo app init <name> --template unified --preset app --confirm-tidb --from-template --clone <dir>
```

Never pass `--confirm-tidb` for `preset=site` or without informed explicit cloud-database consent. Never ask twice when the user already approved database provisioning. Do not expose `--database`, `preset=site`, `preset=app`, `site/none`, `app/tidb`, TiDB, or `--confirm-tidb` as product choices. Feature requirements may establish the need to ask about persistence, but they never establish consent. The daemon owns the deterministic preset-to-Core-pair mapping and must send both Core fields. Do not pass unified fields to legacy `template=static|fullstack` flows. If the installed CLI does not expose this internal preset-only contract, stop and report that Syfo website creation is unavailable; do not fall back to a legacy template.

After an ambiguous init timeout, run only the emitted `syfo app init --resume <commandId>` recovery command. Never rerun init, generate a new idempotency key, or manually clone over a partial destination.

## Existing website machine-local binding recovery

Website source and its Syfo binding are different things. The binding is clone-local state at
`.git/syfo-hosted-app.json`; it contains a short-lived Git credential, is created separately on each
machine, and must never be committed, copied, uploaded, or reconstructed as legacy `.syfo/app.json`.
A normal Git clone therefore does not carry the binding, and its absence does not mean GitLab source
history is broken.

- When the canonical App repository already exists on this machine, identify the authoritative App
  ID, verify that a local Git remote points to the App's canonical repository without embedded
  credentials, then run `syfo app bind <app-id>` from that worktree. This obtains a fresh
  machine-local credential and writes the local binding; it is recovery, not initialization.
- When this machine has no local clone, run `syfo app clone <app-id> --clone <dir>`. Do not manually
  clone and then rerun init, and do not copy another Agent's `.git/syfo-hosted-app.json`.
- Never use `syfo app init` to repair a missing binding for an existing App. If the App ID is unknown,
  the remote does not match the canonical repository, or the destination is ambiguous, stop and get
  authoritative App/repository identity rather than guessing or overwriting files.

After bind or clone, re-run repository classification and continue only when the source markers and
App identity agree.

## Existing unified website cloud database enable

For an existing repository classified as unified, read current state with `syfo app status --json`. Only the exact `preset=site,database=none` state can use the database-enable flow. If the App identity is omitted, the daemon resolves the machine-local binding; if identity or state is ambiguous, stop before mutation.

When the human explicitly asks to add a database, cloud database, or TiDB, or approves persistence after being offered a Syfo cloud database, that is the single informed confirmation. Do not ask again and do not reframe the user-facing confirmation around the current provider. Record the consent in the daemon command:

```bash
syfo app database enable [app-id] --confirm-tidb
```

Never run this command from a generic feature hint alone, never pass a second consent field, and never rerun `syfo app init`. The command only asks Core to atomically enable the active database binding and change desired state from `site/none` to `app/tidb`; it does not modify source, validate, deploy, change the live version, domain, or access policy.

After `state=enabled` or `state=already_enabled`:

1. Re-read `syfo app status --json` and require the exact internal unified `app/tidb` state with an active database binding.
2. Modify the same original repository for cloud-database usage, including `database.required: true`, migrations, runtime data access, and relevant tests. Use TiDB-specific implementation guidance only where the current allocated provider requires it. Do not clone a replacement project or rewrite it as a legacy template.
3. Run the database-enabled website validation workflow below, then commit and push the immutable source.
4. Stop at local/deploy-ready handoff unless the human separately authorized deployment. Database consent is not deploy consent.

If the enable command returns a stable state conflict or other backend error, do not edit the repository as though the transition succeeded. Re-read status and either resume from the observed exact state or report the blocker.

## Legacy upgrade and database consent

An existing legacy App stays legacy by default. Before any upgrade proposal:

1. Report the detected legacy type and current database state.
2. Explain that a unified upgrade can change template/runtime behavior and requires a separate explicit human decision.
3. Keep database enablement separate from template migration and deployment consent.
4. Do not use `syfo app database enable` for a legacy App; the supported operation is only for existing unified `site/none`.
5. Never infer `none -> tidb` merely because requested features need persistence.

Requests such as “add login,” “add an API,” or “store data” authorize product work, not migration, database enablement, or deployment. Ask for the missing decision.

## Scope and lifecycle

Classify requested scope:

- `build_only`: implement and run relevant local checks; no cloud mutation.
- `deploy_ready`: validate and prepare immutable source; no deployment.
- `deploy_authorized`: the human explicitly requested deploy/publish/go live. Follow `references/deployment-lifecycle.md` through confirmation, terminal status, version verification, and cloud smoke.

For UI work, select the smallest appropriate frontend/design/browser capability set available in the current environment. Preserve existing design when requested.

## Multi-agent source collaboration

When multiple Agents work on one hosted website, follow
[`references/multi-agent-collaboration.md`](references/multi-agent-collaboration.md). Select one
integration Agent, use Agent-namespaced branches for other contributors, and let the integration
Agent review and merge without requiring GitLab MR tooling.

## Website icon replacement gate

The official `web-unified` template ships a technically valid placeholder icon family so a fresh clone can build. Those files are template residue, not finished product identity. For every newly created Syfo-hosted website, replace the complete placeholder family before the first `syfo app validate`, deployment preparation, or handoff as deploy-ready. File existence or an otherwise clean doctor result does not make the placeholder acceptable.

For an existing unified website, preserve an intentional product-specific icon unless the user requests a redesign. Replace it when it is still the official placeholder, a generic letter tile, a framework/Syfo logo, copied third-party artwork, or otherwise clearly not the website's identity.

1. Use the website name, purpose, and visual language to choose a distinctive, simple metaphor with a strong silhouette and enough contrast at 16×16.
2. Create source-controlled SVG variants with a shared `viewBox="0 0 512 512"`: `public/favicon-16.svg`, `public/favicon-32.svg`, `public/app-icon-180.svg`, and canonical `public/syfo-app-icon.svg` at 512×512.
3. Render valid RGBA/RGB PNGs into the root `app/` or `src/app/` directory using Next's native convention: `icon1.png` = 16, `icon2.png` = 32, `icon3.png` = 180, and `icon4.png` = 512.
4. Remove competing `favicon.ico`, SVG file-convention icons, unnumbered `icon.*`, extra numbered icons, and `apple-icon.*` so Next emits one coherent metadata family.
5. Keep each SVG regular, self-contained, valid UTF-8, and at most 64 KiB. Require an unprefixed root `<svg xmlns="http://www.w3.org/2000/svg">`; forbid entities, DTD, scripts, event handlers, `foreignObject`, `<style>`/`style=`, SMIL mutation, external resources, secrets, user-uploaded markup, and unlicensed logos. `href`, `src`, and `xlink:href` may reference only a local `#fragment`.
6. Inspect the actual rendering at 16, 32, 180, and 512 pixels. Simplify small variants rather than merely scaling details that disappear.

The unified doctor treats missing, unsafe, incorrectly sized, conflicting, invalid-PNG, unwired, or official placeholder icons as errors. After icon creation, run the doctor again and record zero icon errors before `syfo app validate` or deployment preparation.

## Validation workflow

Select and record one validation mode before running checks:

- `fast`: the default for routine product, UI, icon, and ordinary API changes. It does not run a
  production build, assemble `.fc/artifact`, or start the production server. For Next.js 16+, it
  must generate framework route types before TypeScript checking; bare `tsc --noEmit` is
  insufficient.
- `production`: required for the first deployment; Next.js, Node, lockfile, build-script,
  `next.config.*`, middleware/proxy, route-wrapper, standalone assembly, native dependency, image
  pipeline, server-module initialization, or static-generation changes; any prior cloud build
  failure not fully explained by the fast gate; and explicit production acceptance requests.
- `diagnostic_exception`: allowed once after a cloud build failure when operation diagnostics and
  Build Service logs are unavailable, incomplete, or indicate bundling, artifact assembly, or
  static-generation behavior that the fast gate cannot reproduce. It runs the production checks
  for diagnosis without authorizing another deploy.

Then:

1. Run the unified doctor from the selected App root:

```bash
node <skill-path>/scripts/doctor.mjs --json
```

2. Verify one lock file, exact npm 10 pin for official templates, Node compatibility, `output: standalone`, `.fc/artifact`, `/healthz`, App icons, and secret-free `syfo.yaml`.
3. Keep `database.required: false` for `site+none`; do not exercise migrations or request database credentials.
4. For `app+tidb`, validate migrations only through the allocated App environment and never print connection values.
5. In `fast` mode, run the frozen install, lint, tests, and typecheck. For Next.js 16+, run
   `npm run typegen` immediately before `npm run typecheck`. Run relevant development-server,
   HTTP, and browser smoke when behavior changed. For a database-enabled website, run migrations
   through `syfo app dev -- npm run db:migrate`.
6. In `production` or `diagnostic_exception` mode, additionally run the production build,
   standalone artifact assembly, artifact budget, representative production-server smoke, and
   Linux AMD64 validation when architecture-sensitive.
7. Run `syfo app validate --json` only after the selected local gates pass. This validates the
   repository contract; it does not replace skipped production checks.
8. Before deployment preparation, push a clean immutable commit with the binding-aware command:

```bash
syfo app push --remote syfo --branch main --json
```

Do not substitute `syfo app git-auth -- push ...` during the normal workflow; it is a lower-level
escape hatch and does not provide the same binding-aware summary.

The official cross-repo canary is:

```bash
npm run test:unified-template-canary -- --template /path/to/web-unified
```

## Cloud smoke

After an authorized deployment, read policy with `syfo app status --json`. Do not modify it. Run public or Basic Auth smoke only when compatible with the human-owned policy:

```bash
node <skill-path>/scripts/smoke-cloud-access.mjs --url https://APP_DOMAIN --mode public --path /
```

For Basic Auth, credentials must be explicitly supplied through environment variables. For authenticated/org/org_members application access, validate the real login/session path without weakening policy or exposing credentials.

## Required handoff

Do not append raw CLI JSON or an internal audit object by default.

Report:

- Detected contract: unified, legacy static, legacy fullstack, or ambiguous.
- Current user-facing capability state: cloud database not enabled or cloud database enabled. Include TiDB and exact internal preset/database values only when diagnosing a contract mismatch.
- Requested scope and whether migration, database enablement, deployment, and access changes were authorized separately.
- Selected validation mode and why it applied.
- Immutable source revision and checks actually run.
- Checks intentionally skipped, especially production bundle, standalone artifact, artifact
  budget, production-server smoke, full static generation, Linux target validation, and browser
  acceptance.
- Checks still delegated to the Syfo clean Builder or production acceptance.
- For `diagnostic_exception`, the cloud failure identity, available diagnostics/logs, why the
  exception was necessary, and confirmation that no second deploy was created merely to diagnose.
- Live URL/version only after terminal deployment and production acceptance.

Never report an unexecuted check as passed. Distinguish local readiness from backend/cloud acceptance.
