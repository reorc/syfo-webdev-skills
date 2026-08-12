# Local validation tiers

Run the highest available tier. Report unavailable tiers as `not_run`, never `passed`.

## Resource-constrained hosts

Do not treat low memory or process limits as permission to skip the build immediately. When a Node.js install, test, build, export, or artifact assembly fails with resource evidence such as `SIGABRT`, `pthread_create: Resource temporarily unavailable`, `Cannot fork`, worker termination, or an out-of-memory error:

1. Record the original command, exit status, and resource error.
2. If a configured package mirror rejects the frozen install, retry the npm command with `--registry=https://registry.npmjs.org` without changing the lock file or persisting a global registry override.
3. Retry the affected command once with constrained Node resources:

   ```bash
   UV_THREADPOOL_SIZE=1 \
   NODE_OPTIONS='--v8-pool-size=1 --max-old-space-size=768' \
   <original-command>
   ```

   Also set any repository-supported test or build worker limit to `1`; do not invent unsupported framework flags.
4. If the constrained retry succeeds, continue the normal build, artifact assembly, `syfo app validate`, and smoke workflow.
5. If it still fails for resource reasons, mark only the blocked local build, runtime, test, or browser checks as `not_run`. Continue Tier 0 checks and any independent manifest, asset, route, secret, and artifact-input validation that can still execute safely.

Never report the App as locally verified, deployed, or live while required build/runtime checks are `not_run`. For an authorized deployment, the Syfo clean build environment must rebuild from the immutable source, reach a terminal successful version, and pass `/healthz` plus required access-aware cloud smoke before completion can be claimed.

## Tier 0: static audit

- Repository instructions and appDir reviewed.
- One lock file matches the package manager.
- Install and build commands match that lock file; build output and run command match `.fc/artifact` and `node server.mjs`.
- No server-only API, database runtime, provider binding, or secret value remains.
- `syfo.yaml` commands and paths match repository files.
- Asset bytes, file count, and largest files are recorded.

## Tier 1: host build and runtime

- Frozen install.
- Focused lint, typecheck, and tests.
- Production static export.
- Artifact assembly.
- Start on `0.0.0.0:9000`.
- Health, home, representative routes, static chunks, assets, and 404 checks.
- SIGTERM shutdown check where practical.

## Tier 2: media and browser behavior

- For `new_ui` or `material_change`, record the selected frontend capability and design direction.
- Byte-range request returns 206 for representative audio/video.
- Browser playback and seeking work.
- Direct navigation and refresh work for nested routes.
- No hydration, asset, accessibility, or console failures in representative viewports.
- No unintended browser-default controls, scaffold placeholders, or obvious desktop/mobile hierarchy defects remain.

## Tier 3: Linux target architecture

Required when dependencies contain native binaries or host-generated executables.

- Install and build in a Linux container matching the intended FC architecture.
- Assemble and start the artifact inside that environment.
- Run Tier 1 and relevant Tier 2 checks.

## Tier 4: Syfo/FC acceptance

Only through the authorized backend deployment path:

- Syfo accepts `syfo.yaml` and generates provider deployment configuration.
- FC starts the artifact on the configured port.
- Custom HTTPS domain serves health, pages, static chunks, media, and 404 responses.
- Read the configured access policy from `syfo app status --json`; do not modify it.
- Public mode serves an anonymous representative page with 2xx.
- Basic Auth mode returns anonymous 401 with `WWW-Authenticate: Basic`; verify authorized access only
  when a human explicitly supplies a test credential.
- Logs contain no secrets or full environment dumps.
- Artifact digest and rollback identity are recorded.
