# Historical App maintenance

Use this reference only for a positively identified existing historical Syfo static or fullstack App. It keeps rare legacy maintenance inside `syfo-webdev` without exposing separate creation Skills.

## Entry gate

Verify the existing historical App binding and canonical repository before changing files or running a Syfo mutation.

- Historical static: no `template.id: web-unified`, exported frontend assets, `run.command: node server.mjs`, and `database.required: false`.
- Historical fullstack: no `template.id: web-unified`, a standalone Node server with `run.command: node server.js`, and `database.required: true`.
- Unified: `template.id: web-unified`; return to the main Skill workflow.
- Ambiguous or conflicting markers: stop and ask. Feature requests do not determine the repository type.

Hard stop: historical maintenance must never run `syfo app init`, create a new App, or create a replacement App. Route all new Syfo website creation through the unified workflow in the main Skill.

## Recover the authoritative binding

The binding is clone-local `.git/syfo-hosted-app.json` state and must never be committed, copied, or recreated from another machine or Agent. It is not `.syfo/app.json`.

- When the canonical repository already exists locally, run `syfo app bind <app-id>` from that worktree.
- When no local clone exists, run `syfo app clone <app-id> --clone <dir>`, then verify the historical markers before editing.
- Existing App identity and canonical repository identity must agree before validation, database access, or deployment.
- If the App ID or canonical repository is unknown, stop and obtain it rather than initializing or cloning by hand.

Never run `syfo app init` to recover an existing App, copy `.git/syfo-hosted-app.json`, request a personal Git credential, or allocate a replacement database.

## Preserve the contract

Keep the existing directory, template, runtime, database requirement, and deployment flow. A request for login, APIs, persistence, or another runtime capability is a migration proposal, not permission to migrate.

- Static remains database-free and request-independent. If the requested behavior needs server APIs, application authentication, secrets, persistence, request-time rendering, middleware, or server actions, stop and ask for separate migration authorization.
- Fullstack continues to use its allocated App database and migration history. Verify the canonical binding without exposing connection values; do not provision or silently switch databases.
- Static-to-fullstack or legacy-to-unified migration requires a separate explicit human decision, a migration plan, and independent database/deployment authorization.
- Keep access policy human-owned; read it with `syfo app status --json` and never call `syfo app access set`.

## Select the maintenance branch

### Historical static

Use the maintained resources under `legacy/static/`:

- `references/static-export.md` for eligibility and request-time blockers.
- `references/fc-static-runtime.md`, `references/syfo-contract.md`, and `references/local-validation.md` for runtime and validation requirements.
- `references/assets-and-media.md` for byte ranges, direct asset checks, and real 404 behavior.
- `templates/project-assemble-static.mjs`, `templates/project-static-server.mjs`, and `templates/syfo.nextjs-static.yaml` for the established artifact shape.
- `scripts/doctor.mjs` and `scripts/smoke-static.mjs` for legacy-specific checks.

Preserve static export semantics. The small Node adapter may serve files, health checks, cache headers, byte ranges, and correct 404 responses; it must not become an application backend.

### Historical fullstack

Use the maintained resources under `legacy/fullstack/`:

- `references/syfo-contract.md`, `references/fc-runtime.md`, and `references/local-validation.md` for the historical standalone contract.
- `references/database-migration.md` and `references/tidb-serverless.md` only for the already allocated database binding.
- `templates/syfo.nextjs-fullstack.yaml` and `templates/healthz-route.ts` for the existing artifact shape.
- `scripts/assemble-next-standalone.mjs`, `scripts/doctor.mjs`, `scripts/smoke-server.mjs`, and `scripts/smoke-cloud-access.mjs` for legacy-specific assembly and checks.

Preserve the standalone Node entrypoint, stateless FC assumptions, health route, bounded database connections, and repeatable migrations.

## Scope and deployment

Classify the requested scope before work:

- `build_only`: edit and validate locally; do not prepare a deploy card.
- `deploy_ready`: validate, push an immutable commit, and prepare the human confirmation card unless explicitly excluded.
- `deploy_authorized`: prepare the card, wait for human confirmation, then continue through terminal deployment, version verification, and cloud acceptance.

For `deploy_ready` or `deploy_authorized`, follow the matching `legacy/<type>/references/deployment-lifecycle.md`. A successful build or local smoke is not a completed deployment. Preparation is not publication, and actual deployment always requires human confirmation.

Run validation in layers: source/config checks, the matching legacy doctor, deterministic build, artifact assembly, local smoke, `syfo app validate --json`, and Linux AMD64 validation when native dependencies exist. After deployment, verify the intended commit is live and run access-aware production smoke without weakening the configured policy.

## Handoff

Return a concise human-readable result. Do not append raw CLI JSON or an internal audit object by default.

- State the identified legacy type and immutable source revision.
- State which local, artifact, Syfo validation, deployment, and cloud checks actually ran.
- For a completed deployment, put the live URL first and confirm the live version matches the intended source.
- For `build_only` or an unconfirmed card, state that no live deployment occurred and name the next concrete action.
- Report ambiguous identity, missing credentials, destructive migration needs, or unavailable acceptance evidence as explicit stop conditions.
