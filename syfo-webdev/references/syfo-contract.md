# Unified Syfo application contract

The accepted application contract is `syfo.yaml` version 1 with `template.id: web-unified`.

New create accepts only:

- `template=unified,preset=site,database=none`
- `template=unified,preset=app,database=tidb`

Missing, invalid, or crossed fields are errors. Legacy template commands remain unchanged and must not accept or derive unified fields.

The runtime is Next.js standalone on Node 20, assembled into `.fc/artifact`, started with `node server.js`, and checked at `/healthz`. TiDB is declared by the template but optional for site+none and required only for app+tidb. No provider credentials, domains, certificates, account identifiers, or secret values belong in the manifest.
