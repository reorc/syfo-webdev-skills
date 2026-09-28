# TiDB Cloud Starter and Essential

## Connection contract

Use platform-injected values:

```text
TIDB_HOST
TIDB_PORT
TIDB_USER
TIDB_PASSWORD
TIDB_DATABASE
```

Do not print a composed connection URL. Build the driver configuration in server-only code.

## TLS

- Require TLS in preview and production.
- Use the CA and TLS settings required by the current TiDB Cloud connection dialog and official driver guidance.
- Do not disable certificate verification to make a test pass.
- Keep local disposable TiDB configuration visibly separate from cloud TLS configuration.

## Pooling for FC

- Use a bounded per-instance pool.
- Calculate total possible connections as pool maximum multiplied by potential FC instance count.
- Configure idle cleanup and finite connection lifetime so terminated or recycled serverless connections are replaced.
- Avoid opening a new connection for every query.
- Close the pool on graceful shutdown when possible.
- Retry only safe transient operations with bounded attempts and jitter.

## SQL compatibility

- Use the MySQL/TiDB dialect.
- Review SQLite/D1-specific column definitions, defaults, pragmas, and migration APIs.
- Review PostgreSQL-specific types, operators, and transaction assumptions.
- Do not assume every MySQL feature or foreign-key behavior is identical without validation.
- Keep schema migrations ordered and auditable.

## JSON contract

Test all of:

- String.
- Number.
- Boolean.
- Null.
- Array.
- Object.

Drivers may return already-decoded JSON values. Normalize at the repository boundary and do not call `JSON.parse` unconditionally.

## Serverless behavior

TiDB Cloud Starter and Essential may recycle or terminate connections. The application must recover through bounded pooling rather than keeping process-lifetime assumptions.
