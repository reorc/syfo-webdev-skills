# Unified Syfo application contract

The accepted application contract is `syfo.yaml` version 1 with `template.id: web-unified`.

The user-facing CLI accepts only these presets:

- `template=unified,preset=site`
- `template=unified,preset=app`

The daemon deterministically maps `site` to the complete Core pair `preset=site,database=none` and `app` to `preset=app,database=tidb`. The CLI must not expose `--database`. Missing or invalid presets are errors, and `preset=app` requires disclosure and confirmation before TiDB provisioning. Legacy template commands remain unchanged and must not accept or derive unified fields.

The runtime is Next.js standalone on Node 20, assembled into `.fc/artifact`, started with `node server.js`, and checked at `/healthz`. TiDB is declared by the template but optional for site+none and required only for app+tidb. No provider credentials, domains, certificates, account identifiers, or secret values belong in the manifest.
