---
name: syfo-webdev
description: "The only Skill for creating any new Syfo website or Hosted App, plus maintenance of template.id: web-unified Apps and read-only classification of a Syfo repository. New creation accepts only template=unified with preset=site or preset=app; the daemon deterministically maps site to the Core site/none pair and app to app/tidb. If delivery target, preset, or repository type is unclear, ask the user before any Syfo CLI action and never infer or coerce a choice. For preset=app, disclose that TiDB will be provisioned; the human's informed App selection or explicit TiDB App request is the single confirmation, so pass --confirm-tidb without asking twice. Existing historical static/fullstack Apps remain on the legacy syfo-webdev-static or syfo-webdev-fullstack maintenance Skills unless a human separately authorizes migration. Do not auto-trigger for generic websites, standalone HTML, local previews, or another hosting provider. Never silently migrate, enable a database, deploy, or change access policy."
---

# Syfo WebDev Unified

Build, repair, validate, package, and—only when explicitly authorized—deploy a Syfo Hosted App based on the `web-unified` template.

## Delivery target and Skill relationship

Before any Syfo CLI command, resolve the target:

- `local_html`: the user wants only an HTML file or local preview. Do not initialize, validate, package, or deploy Syfo.
- `syfo_hosted_app`: all new Syfo websites and Apps use this unified Skill. Existing `template.id: web-unified` Apps also stay here. Positively identified historical static/fullstack Apps route to their matching legacy maintenance Skill without reinterpretation.
- `unknown`: the user mentions Syfo but has not confirmed local HTML vs Hosted App, or a new Syfo App lacks a valid preset/database pair, or existing repository markers are missing/conflicting. Ask the minimum focused question and do not choose a template, initialize, migrate, enable a database, or deploy meanwhile.

`syfo-webdev-static` and `syfo-webdev-fullstack` are compatibility aliases for historical Apps only. They never create a new website or App. “Please send me the HTML” means `local_html` unless the user separately requests Syfo hosting.

## Safety contract

- Read repository instructions before changing files.
- Treat `syfo.yaml` with `template.id: web-unified` as the deterministic unified marker.
- Preserve existing legacy static/fullstack repositories and route them to the matching legacy Skill.
- Never reinterpret an existing App as unified because a feature request mentions login, APIs, or a database.
- Never enable TiDB, migrate a template, deploy, or change access policy without separate explicit human consent for that action.
- To keep access policy human-owned, never call `syfo app access set`.
- Do not generate provider-specific `s.yaml` or persist cloud credentials.

## Repository classification

Classify before any Syfo mutation:

1. **Unified**: `syfo.yaml` contains `template.id: web-unified`. Continue here and preserve its current preset/database state.
2. **Legacy static**: no unified marker, static export/adapter markers, `run.command: node server.mjs`, or `database.required: false` in the legacy static contract. Use `syfo-webdev-static` without rewriting the template.
3. **Legacy fullstack**: no unified marker, standalone legacy markers, `run.command: node server.js`, and `database.required: true`. Use `syfo-webdev-fullstack` without rewriting the template.
4. **Ambiguous**: missing or conflicting markers. Stop and ask; do not guess, initialize, migrate, enable a database, or deploy.

Detection is read-only. A classification result is not migration consent.

## New App create contract

For a new App, require the human to choose exactly one user-facing preset:

- Site: `template=unified`, `preset=site`; the daemon sends the complete Core pair `site/none`.
- App: `template=unified`, `preset=app`; the daemon sends the complete Core pair `app/tidb`.

If the request says only “new Syfo website/App” without an informed preset choice, ask once whether they want a site with no database or an app that provisions TiDB. Do not infer from feature hints alone. A human selection of App after that disclosure is the required confirmation. An initial explicit request for a TiDB-backed App or informed `preset=app` selection also counts as confirmation, so do not ask again. Include `--confirm-tidb` only when one of those informed explicit choices exists; the flag records that consent for the daemon and never requires a second confirmation prompt.

Use the corresponding preset-only CLI exactly; `--database` is not a user-facing init flag:

```bash
syfo app init <name> --template unified --preset site --from-template --clone <dir>
syfo app init <name> --template unified --preset app --confirm-tidb --from-template --clone <dir>
```

Never pass `--confirm-tidb` for `preset=site` or without an informed explicit App/TiDB choice. Never ask twice when that choice already confirms TiDB provisioning. Do not expose or pass `--database`, infer a preset from feature prose, or pass unified fields to legacy `template=static|fullstack|nextjs` flows. The daemon owns the deterministic preset-to-Core-pair mapping and must send both Core fields. If the installed CLI does not expose this preset-only contract, stop and report that the unified create capability is unavailable; do not fall back to a legacy template.

After an ambiguous init timeout, run only the emitted `syfo app init --resume <commandId>` recovery command. Never rerun init, generate a new idempotency key, or manually clone over a partial destination.

## Upgrade and database consent

An existing legacy App stays legacy by default. Before any upgrade proposal:

1. Report the detected legacy type and current database state.
2. Explain that a unified upgrade can change template/runtime behavior and requires a separate explicit human decision.
3. Keep database enablement separate from template migration and deployment consent.
4. Accept database transition only from `none` to `tidb`, and only after explicit authorization through the supported operation.
5. Never infer `none -> tidb` merely because requested features need persistence.

Requests such as “add login,” “add an API,” or “store data” authorize product work, not migration, database enablement, or deployment. Ask for the missing decision.

## Scope and lifecycle

Classify requested scope:

- `build_only`: implement and run relevant local checks; no cloud mutation.
- `deploy_ready`: validate and prepare immutable source; no deployment.
- `deploy_authorized`: the human explicitly requested deploy/publish/go live. Follow `references/deployment-lifecycle.md` through confirmation, terminal status, version verification, and cloud smoke.

For UI work, select the smallest appropriate frontend/design/browser capability set available in the current environment. Preserve existing design when requested.

## Validation workflow

1. Run the unified doctor from the selected App root:

```bash
node <skill-path>/scripts/doctor.mjs --json
```

2. Verify one lock file, exact npm 10 pin for official templates, Node compatibility, `output: standalone`, `.fc/artifact`, `/healthz`, App icons, and secret-free `syfo.yaml`.
3. Keep `database.required: false` for `site+none`; do not exercise migrations or request database credentials.
4. For `app+tidb`, validate migrations only through the allocated App environment and never print connection values.
5. Run lint, typecheck, tests, build, artifact budget, Linux AMD64 validation when architecture-sensitive, and representative server smoke.
6. Run `syfo app validate --json` only after local gates pass.
7. Push a clean immutable commit before deployment preparation.

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
- Current preset/database state when known.
- Requested scope and whether migration, database enablement, deployment, and access changes were authorized separately.
- Immutable source revision and checks actually run.
- Live URL/version only after terminal deployment and production acceptance.

Never report an unexecuted check as passed. Distinguish local readiness from backend/cloud acceptance.
