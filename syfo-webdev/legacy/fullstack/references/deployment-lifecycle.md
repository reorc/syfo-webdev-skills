# Hosted App deployment lifecycle

Use this state machine for `deploy_ready` and `deploy_authorized` work. Ownership, deploy
preparation, human confirmation, build, and publication are separate states; do not infer one
from another.

| State | Evidence | Next action |
| --- | --- | --- |
| `initialized` | Local binding exists; `owner` may be `null` | Implement and validate the App |
| `validated` | Local checks and `syfo app validate --json` pass | Commit and push immutable source |
| `source_ready` | Clean pushed commit SHA exists | Run `syfo app deploy --target "<reply-target>" --json` unless preparation is explicitly excluded |
| `awaiting_confirmation` | Deploy/action-card identifiers and intended commit recorded | Wait for human confirmation |
| `building` / `publishing` | Status or version reports a non-terminal state | Poll status and versions |
| `failed` | Structured failure stage/code is available | Follow the failure branch below |
| `active` | Intended commit is the live version | Read access policy, then run production acceptance |

## Preparing and replacing deploy cards

For a ready Syfo-hosted website delivery, prepare the card without a separate conversational deploy
request. Respect explicit local/source-only, no-deploy, or no-card constraints unless the user
specifically requests card preparation. Only a human may confirm actual deployment.

Preparation may run a remote `dry_run` preflight, consuming build resources before a card exists.
It checks source/manifest, worker and billing eligibility, and, once admitted, creates a candidate
version, an `awaiting_confirm` operation, and a card with an approval notification. It does not
publish a live version. Prepare at a completed, validated delivery checkpoint, not after each edit.
If the CLI reports `hosted_app_preflight_in_progress`, preserve the returned preflight identity and
report that no card exists yet; use only a supported completion/recovery path. Do not busy-retry or
claim a card was sent. After verified preflight success, resume preparation for the same commit.
If the installed CLI cannot expose that progress, report the capability gap instead of inventing
commands or creating more work to obtain status.

- Reuse an existing pending card for the same App and commit. Each fresh CLI invocation creates a
  new command ID; repeated invocations are not deduplicated by commit and can create more cards.
- An unconfirmed card does not lock source development. After further requested edits, validate
  and push the new immutable commit before preparing a new card. Record each card/operation and
  its bound commit; use `--message` to identify the revision and change summary for human review.
- Creating a new card does not invalidate older pending cards. Until the new card is confirmed,
  an older card can still deploy its original commit; later Git pushes do not update that target.
  Tell the human which card is current and that earlier cards must not be confirmed. Never claim
  the old card has been canceled merely because a new one exists.
- Confirming a newer deploy rejects older pending deploy operations for the same App. An active
  confirmed/queued/running deploy blocks another confirmation with `hosted_app_deploy_already_active`;
  recover that operation's state instead of issuing more cards.
- After rejection or expiry, do not automatically reissue a card. Wait for a new delivery request
  or meaningful source revision, and preserve any explicit instruction to stop deployment.

## Git credentials are managed

- Push credentials come only from the managed hosted-app chain: `syfo app push` and `syfo app
  git-auth` obtain a short-lived App-scoped credential automatically. Never create a `syfo secret
  request` for a GitLab or personal access token to push, clone, or repair a website.
- A missing machine-local binding is a bind/clone recovery, not a credential problem: stop at
  `syfo app bind <app-id>` / `syfo app clone <app-id> --clone <dir>` and report. An App the Agent
  cannot access ends as the server's `NOT_FOUND` or permission error, never as a request for
  personal credentials.

## Access policy ownership

- App initialization assigns the platform default access policy. The Agent must not change it.
- Read the current policy from `syfo app status --json` at deployment acceptance time.
- If the current policy does not match the user's requirement, stop and ask a human to update it in
  the Hosted App management UI. Re-read status after the human change before continuing.
- Never call or suggest `syfo app access set`; access policy is a human-owned security boundary.
- Run only the acceptance checks possible with credentials explicitly supplied by the human. Do not
  request, retrieve, rotate, print, or persist Basic Auth credentials.

## Ownership and deploy authority

- `owner=null` on an existing historical App is a valid unclaimed draft, not a binding failure.
- Do not run `syfo app claim` as a routine prerequisite. A first deploy confirmation may claim the
  App for the confirming human.
- Use `syfo app claim` only when the user explicitly wants ownership established before deployment,
  or when the CLI returns a specific ownership-required result.
- The Agent prepares the deploy confirmation card; a human owner/admin commits the paid mutation.
- `--target` is required when preparing the confirmation card. Use the complete current task/message
  reply target supplied by the runtime; do not omit it, shorten it, or invent a channel identifier.
  If no valid reply target is available, stop before deploy preparation and ask for one.
- If deploy preparation returns `FORBIDDEN`, report the exact server error. Do not retry `claim`
  blindly or describe source/build work as failed. If the server says the actor cannot prepare a
  deploy, hand off the intended commit and ask the owner to initiate from the UI/authorized CLI.

## Failure branches

- `authorization`: no deployment was admitted. Resolve actor/owner capability; do not inspect build
  logs or blame application code.
- `pre_build`: an operation/version exists but no `buildId` was assigned. Inspect Core admission,
  billing, confirmation, worker readiness, repository preflight, and database preflight.
- `build`: `buildId` exists and the build failed. Use Build Service logs and deterministic failure
  codes.
- `publish`: the build succeeded but FC publication, health, database/runtime activation, or domain
  activation failed. Inspect provider/publication diagnostics and preserve the build identity.

Record the deploy response's `operationId`, `actionCardId`, intended commit, App ID, and version when
present. Reuse that identity through confirmation, polling, terminal verification, and reporting;
do not create a second deploy operation merely to recover status.

Until the CLI provides operation-by-ID lookup, `syfo app status --json` and
`syfo app versions --json` are the fallback diagnostic surface. Correlate their results with the recorded operation,
version, and commit instead of assuming the latest deploy is the intended one. Do not query product
databases as a routine workaround. If the fallback cannot identify the same operation or structured
failure fields are unavailable, state that CLI observability is insufficient, preserve the raw
command output, and escalate rather than guessing.
