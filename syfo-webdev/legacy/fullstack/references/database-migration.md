# Database migration playbook

## Inventory

Before editing schema or migrations, identify:

- Current database engine and driver.
- ORM or query builder.
- Migration history and production data assumptions.
- Provider-specific APIs and generated types.
- Destructive operations.
- JSON, datetime, enum, generated-column, index, and foreign-key usage.

## Migration order

1. Introduce a database repository boundary if provider APIs are spread through UI or route code.
2. Add TiDB/MySQL driver configuration behind server-only modules.
3. Translate schema and migrations.
4. Add migration repeatability tests.
5. Add repository contract tests.
6. Run against disposable local TiDB.
7. Run against disposable TiDB Cloud over TLS when available.
8. For a Syfo Hosted App, run migrations twice and contract/seed checks through
   `syfo app dev -- <command>` against the App's allocated canonical database
   binding. Reject missing or stub bindings and do not print connection values.
9. Remove obsolete runtime dependencies only after behavior matches.

## Safety

- Require approval for destructive migration steps.
- Backfill before adding strict constraints when existing data may violate them.
- Avoid implicit migration execution during ordinary application startup.
- Return non-zero on migration failure.
- Record migration version and outcome without logging credentials.
- Do not use another App's database or a disposable compatibility database as
  evidence that the allocated App database was migrated.

## Contract tests

Cover:

- Create, read, update, and delete for representative records.
- Unique and foreign-key expectations used by business logic.
- Transactions used by critical workflows.
- Datetime and timezone behavior.
- JSON scalar and structured values.
- Migration rerun or no-op behavior.
