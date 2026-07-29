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
8. Remove obsolete runtime dependencies only after behavior matches.

## Safety

- Require approval for destructive migration steps.
- Backfill before adding strict constraints when existing data may violate them.
- Avoid implicit migration execution during ordinary application startup.
- Return non-zero on migration failure.
- Record migration version and outcome without logging credentials.

## Contract tests

Cover:

- Create, read, update, and delete for representative records.
- Unique and foreign-key expectations used by business logic.
- Transactions used by critical workflows.
- Datetime and timezone behavior.
- JSON scalar and structured values.
- Migration rerun or no-op behavior.
