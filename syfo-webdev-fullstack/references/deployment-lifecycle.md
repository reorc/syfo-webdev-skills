# Hosted App deployment lifecycle

Use this state machine for `deploy_ready` and `deploy_authorized` work. Ownership, deploy
preparation, human confirmation, build, and publication are separate states; do not infer one
from another.

| State | Evidence | Next action |
| --- | --- | --- |
| `initialized` | Local binding exists; `owner` may be `null` | Implement and validate the App |
| `validated` | Local checks and `syfo app validate --json` pass | Commit and push immutable source |
| `source_ready` | Clean pushed commit SHA exists | Run `syfo app deploy --json` when authorized |
| `awaiting_confirmation` | Deploy/action-card identifiers returned | Wait for human confirmation |
| `building` / `publishing` | Status or version reports a non-terminal state | Poll status and versions |
| `failed` | Structured failure stage/code is available | Follow the failure branch below |
| `active` | Intended commit is the live version | Read access policy, then run production acceptance |

## Access policy ownership

- App initialization assigns the platform default access policy. The Agent must not change it.
- Read the current policy from `syfo app status --json` at deployment acceptance time.
- If the current policy does not match the user's requirement, stop and ask a human to update it in
  the Hosted App management UI. Re-read status after the human change before continuing.
- Never call or suggest `syfo app access set`; access policy is a human-owned security boundary.
- Run only the acceptance checks possible with credentials explicitly supplied by the human. Do not
  request, retrieve, rotate, print, or persist Basic Auth credentials.

## Ownership and deploy authority

- `owner=null` after `syfo app init` is a valid unclaimed draft, not an initialization failure.
- Do not run `syfo app claim` as a routine prerequisite. A first deploy confirmation may claim the
  App for the confirming human.
- Use `syfo app claim` only when the user explicitly wants ownership established before deployment,
  or when the CLI returns a specific ownership-required result.
- The Agent prepares the deploy confirmation card; a human owner/admin commits the paid mutation.
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

`syfo app status --json` and `syfo app versions --json` are the normal diagnostic surface. Do not
query product databases as a routine workaround. If structured failure fields are unavailable,
state that observability is insufficient and preserve the raw command error for escalation.
