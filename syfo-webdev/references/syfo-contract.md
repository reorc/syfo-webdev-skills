# Unified Syfo application contract

The accepted application contract is `syfo.yaml` version 1 with `template.id: web-unified`.

The user-facing CLI accepts only these presets:

- `template=unified,preset=site`
- `template=unified,preset=app`

The daemon deterministically maps `site` to the complete Core pair `preset=site,database=none` and `app` to `preset=app,database=tidb`. The CLI must not expose `--database`. Missing or invalid presets are errors. `preset=app` requires one informed explicit consent to TiDB provisioning: either the human selects App after the TiDB disclosure or initially requests a TiDB-backed App or informed `preset=app`. That choice is the confirmation; never ask twice. The confirmed init command must include `--confirm-tidb`, while `preset=site` must never include that flag. Legacy template commands remain unchanged and must not accept or derive unified fields.

An existing unified `site/none` App may transition in place only through `syfo app database enable [app-id] --confirm-tidb` after the same one informed TiDB confirmation. The daemon sends only the command envelope to Core. A successful `enabled|already_enabled` response means Core has an active binding and the desired pair is `app/tidb`; it does not mean repository code or configuration was changed. The Skill must re-read status, modify the same repository to require and use TiDB, validate it, and keep deployment behind separate authorization. Never use this operation for legacy Apps or rerun init to add a database.

The runtime is Next.js standalone on Node 20, assembled into `.fc/artifact`, started with `node server.js`, and checked at `/healthz`. TiDB is declared by the template but optional for site+none and required only for app+tidb. No provider credentials, domains, certificates, account identifiers, or secret values belong in the manifest.
