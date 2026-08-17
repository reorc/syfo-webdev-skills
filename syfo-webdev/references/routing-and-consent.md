# Routing and consent

## Deterministic routing

- `template.id: web-unified` → `syfo-webdev`.
- Legacy static markers → `syfo-webdev-static`.
- Legacy fullstack markers → `syfo-webdev-fullstack`.
- Missing/conflicting markers → stop as ambiguous.

## Independent consent gates

The following are separate decisions and none implies another:

1. Modify application code.
2. Migrate a legacy App to unified.
3. Enable TiDB (`none -> tidb` only).
4. Prepare or execute deployment.
5. Change access policy (human UI only).

Detection and feature requirements never satisfy these gates.

## User-facing terminology

- Call the product a **Syfo website**, **Syfo-hosted website**, or **Syfo Websites**.
- Treat “Syfo Hosted App” as a legacy synonym for Syfo hosting only. It never means `preset=app` and never authorizes TiDB.
- Never ask the user to choose Site versus App. Those are internal compatibility values.
- A newly selected Syfo-hosted website defaults to no database. Ask about TiDB only when persistence is required and consent is missing.
- Feature requirements may trigger the TiDB question, but only an explicit TiDB request or an informed yes authorizes provisioning.

## Existing unified website transition

The only in-place database transition is an existing unified `site/none` App becoming `app/tidb`:

1. Read `syfo app status --json` and verify the exact current state and App identity.
2. Disclose that TiDB will be provisioned and obtain one informed confirmation. An explicit informed TiDB request already counts; never ask twice.
3. Run `syfo app database enable [app-id] --confirm-tidb`. The flag records consent and is not a second prompt.
4. Require `enabled|already_enabled`, then re-read status and verify unified `app/tidb` plus active TiDB.
5. Modify the same repository for TiDB usage, set `database.required: true`, add migrations/data access/tests, and validate.
6. Deploy only after separate explicit authorization.

The enable operation changes Core/database state only. It does not modify source, validate, deploy, change live version, domain, or access. Never use it for legacy Apps or as a substitute for migration consent.
