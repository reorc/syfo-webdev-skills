# Alibaba Cloud FC runtime

## Runtime decision

Choose between:

- Code-package custom runtime with a platform-managed Node.js runtime or layer.
- Custom container when runtime binaries, native dependencies, browser binaries, or OS packages must be controlled precisely.

Do not select solely from a copied example. Runtime names and availability vary by region. Verify the intended region before generating provider deployment configuration.

## HTTP contract

- Bind `0.0.0.0`.
- Read `PORT`; use `9000` for local and manifest defaults.
- Run in the foreground.
- Use request timeouts and bounded external calls.
- Avoid process-local durable state.
- Treat local disk as temporary cache only.
- Send logs to stdout/stderr.

## Architecture compatibility

- Identify the FC execution architecture selected by the deployment plan.
- For native Node.js dependencies, build and test on the same OS and architecture.
- Mac ARM builds do not prove Linux AMD64 compatibility.
- Do not package host `node_modules` when native or install-time binaries are present.

## Domain behavior

- Use the FC-generated URL for probes, not as the public application origin.
- Validate authentication redirects and absolute URLs on the custom domain.
- Verify the exact hostname is covered by the HTTPS certificate.
- Do not assume a single-level wildcard covers a multi-level hostname.

## Secrets

- Keep Alibaba Cloud credentials in Serverless Devs access, CI secrets, or Syfo control-plane storage.
- Do not put secrets into `s.yaml`, source files, build arguments, logs, or handoff JSON.
- If a deployment tool prints environment snapshots, filter or disable them before use.
