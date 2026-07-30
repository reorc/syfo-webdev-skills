# Syfo application contract

The accepted application contract is `syfo.yaml` version 1 unless the repository contains a newer approved specification.

## Required behavior

- Place `syfo.yaml` at the selected `appDir` root.
- Keep every path relative to `appDir` and contained within it.
- Use one matching dependency lock file and a frozen install command.
- Declare deterministic install, build, run, health, migration, environment-name, and routing behavior.
- Keep provider resource IDs, actual domains, credentials, secret values, and certificate material out of the manifest.
- Syfo backend services translate the accepted manifest into provider-specific `s.yaml` and FC infrastructure. Application-building agents must not generate or maintain that provider file.

## Next.js + TiDB baseline

- `app.type`: `nextjs`.
- `runtime.family`: `nodejs`.
- `build.install`: `npm ci` for the official `package-lock.json` template.
- `build.command`: `npm run build`; the project build script assembles the artifact.
- `build.output`: `.fc/artifact`.
- `run.command`: `node server.js` inside the declared artifact.
- `run.port`: `9000`.
- `run.healthCheck.path`: `/healthz`.
- `database.engine`: `tidb`.
- `database.required`: `true` when the runtime needs the database.
- `database.migrations.command`: deterministic and non-interactive.

## Rejection conditions

- Unknown or unsupported manifest version.
- Missing lock file or mismatch with the install command.
- Multiple dependency lock files.
- Package manager mismatch across lock file, install, build, and migration commands.
- Absolute path or path escape.
- Missing build output after the declared build.
- Health endpoint failure.
- Required database without migrations.
- Secret-like values in YAML.
- Cloud provider credentials, domains, ARNs, account IDs, or actual connection strings.
- Platform-owned variables declared as application-owned secrets.

## Source baseline

This skill was derived from the following accepted product documents on July 20, 2026:

- `Syfo 托管 FaaS：阿里云 FC、TiDB 与应用接入规范`, revision 35.
- `syfo.yaml v1：Syfo 托管应用清单规范`, revision 4.
- `Skill：为 Syfo 托管 FaaS 准备应用`, revision 5.

When these documents conflict with an approved repository specification, use the repository specification and report the discrepancy.
