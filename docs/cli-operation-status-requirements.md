# CLI operation status requirements

## Problem

Hosted App deployment preparation returns an operation identity, but the CLI cannot reliably query
that exact operation later. `syfo app status` and `syfo app versions` expose App-level or version-level
state, so an Agent may accidentally correlate confirmation, build, publication, and failure details
with a different or newer deployment.

## Required command

```bash
syfo app operation status <operation-id> --json
```

The command must query the supplied operation ID directly. It must not resolve through
`latestDeploy`, the newest version, or the newest confirmation card.

## Required response

```json
{
  "operationId": "...",
  "actionCardId": "...",
  "appId": "...",
  "version": 3,
  "versionId": "...",
  "commitSha": "...",
  "confirmationState": "awaiting_confirm|approved|rejected",
  "operationState": "prepared|queued|running|terminal",
  "versionState": "preparing|building|deploying|published|failed",
  "createdAt": "...",
  "confirmedAt": "...",
  "publishedAt": "...",
  "error": null
}
```

When failed, `error` should include a stable stage and code plus the available structured build or
publish diagnostics. Unknown fields may be `null`, but the three state dimensions must remain
separate.

## Related command changes

- `syfo app deploy --target "<reply-target>" --json` should always return `operationId`,
  `actionCardId`, `appId`, `commitSha`, and version identity when allocated.
- `syfo app status --json` and `syfo app versions --json` should include related `operationId` and
  `actionCardId` values.
- The CLI should support `syfo app status --no-cache --json`, or return `observedAt` and `cacheAgeMs`,
  so polling and watch behavior can distinguish fresh state from cached state.
- A terminal operation query must remain stable and continue returning the same commit, version,
  confirmation card, and terminal result.

## Error behavior

- Unknown operation: return a stable `hosted_app_operation_not_found` code.
- Unauthorized principal: return the current principal and required read capability without leaking
  private App data.
- Backend timeout: preserve the operation ID and return a retryable error; do not fall back to the
  latest App operation.
- Partial data: return known identity fields and explicit `null` state fields rather than silently
  substituting another operation.

## Acceptance cases

1. Query an operation before confirmation, after approval, while building, and after publication;
   every response remains bound to the same operation, card, commit, and version.
2. Create a newer deployment, then query the older operation; the older result must not change to
   the newer deployment.
3. Query a failed build and receive its stable failure stage/code and available diagnostics.
4. Query a published operation immediately after creating a watch; the first fresh probe succeeds.
5. Query as a read-only reviewer; status is readable while deploy and access mutations remain
   forbidden.
