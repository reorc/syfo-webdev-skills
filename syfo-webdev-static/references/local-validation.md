# Local validation tiers

Run the highest available tier. Report unavailable tiers as `not_run`, never `passed`.

## Tier 0: static audit

- Repository instructions and appDir reviewed.
- One lock file matches the package manager.
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
- Logs contain no secrets or full environment dumps.
- Artifact digest and rollback identity are recorded.
