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
