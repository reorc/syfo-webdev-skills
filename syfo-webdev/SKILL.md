---
name: syfo-webdev
description: "Use for new or existing Syfo Hosted Apps that use the unified web-unified template, and for explicit new Syfo App creation where the user chooses site without a database or app with TiDB. Also use to classify an existing Syfo repository before changing it. New creation accepts only template=unified with preset=site,database=none or preset=app,database=tidb; never infer, coerce, or cross these pairs. Existing legacy static/fullstack Apps remain on syfo-webdev-static or syfo-webdev-fullstack unless a human separately and explicitly authorizes migration. Do not auto-trigger for generic websites, standalone HTML, local previews, or another hosting provider. Never silently migrate, enable a database, deploy, or change access policy."
---

# Syfo WebDev Unified

Build, repair, validate, package, and—only when explicitly authorized—deploy a Syfo Hosted App based on the `web-unified` template.

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

For a new App, require the human to choose exactly one valid pair:

- Site: `template=unified`, `preset=site`, `database=none`.
- App: `template=unified`, `preset=app`, `database=tidb`.

Use the corresponding CLI fields exactly:

```bash
syfo app init --template unified --preset site --database none --from-template --clone
syfo app init --template unified --preset app --database tidb --from-template --clone
```

Do not omit fields, infer a pair from prose, coerce crossed pairs, or pass unified fields to legacy `template=static|fullstack|nextjs` flows. If the installed CLI does not expose this wire, stop and report that the unified create capability is unavailable; do not fall back to a legacy template.

After an ambiguous init timeout, resume only the emitted command ID. Never rerun init, generate a new idempotency key, or manually clone over a partial destination.

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
