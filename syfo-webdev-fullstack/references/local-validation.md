# Local validation tiers

Run the highest available tier. Report unavailable tiers as `not_run`, never `passed`.

## Tier 0: static audit

- Repository instructions and write set reviewed.
- Lock file matches the package manager.
- Install, build, migration, output, and run commands match that single lock file and the assembled artifact contract.
- No secret values in source, manifests, artifacts, or logs.
- No runtime D1, SQLite, Cloudflare binding, or Edge Runtime dependency remains.
- `syfo.yaml` paths and commands match repository files.

## Tier 1: host runtime

- Frozen install.
- Focused lint, typecheck, unit, and integration tests.
- Production build.
- Standalone artifact assembly.
- Start on `0.0.0.0:9000`.
- Health, home, representative page/API, static assets, and redirect smoke checks.
- SIGTERM shutdown check where practical.
- For `new_ui` or `material_change`, record the selected frontend capability and validate primary desktop/mobile journeys in a real browser.
- Do not pass frontend acceptance when unintended default controls, scaffold placeholders, console errors, inaccessible focus, or obvious responsive defects remain.

## Tier 2: disposable local TiDB

- Start a pinned official TiDB development image or approved local environment.
- Wait for readiness rather than sleeping a fixed duration.
- Run migrations twice.
- Run repository and JSON contract tests.
- Exercise pool exhaustion protection and reconnect behavior when practical.
- Destroy the disposable data after the test unless debugging is requested.

## Tier 3: Linux target architecture

Required when native modules, browser binaries, image libraries, or host-generated executables exist.

- Install and build in a Linux container matching target architecture.
- Assemble and start the artifact inside that environment.
- Run Tier 1 smoke checks against the container.
- Do not copy Mac or Windows dependency directories into the artifact.

## Tier 4: disposable TiDB Cloud

Only with explicit credentials and an isolated database:

- Connect over TLS with certificate verification.
- Run migrations twice.
- Run database contract tests.
- Confirm bounded pool settings.
- Drop or clean the disposable test objects according to the approved policy.

## Tier 5: FC acceptance

Only with deployment authorization:

- Deploy a non-production version.
- Probe the FC URL internally.
- Validate the custom HTTPS domain externally.
- Check health, assets, redirects, API, database write/read, logs, and rollback metadata.
- Verify the configured access policy from the public domain: anonymous 2xx for public mode;
  anonymous 401 plus `WWW-Authenticate: Basic` for Basic Auth; and 2xx with an authorized test credential.
- Scan output for leaked secrets before sharing logs.
