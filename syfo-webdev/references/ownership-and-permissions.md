# Ownership and permissions

Use this reference when an operation depends on ownership, an unclaimed website cannot complete
requested setup, or `FORBIDDEN` needs a concrete next action. Read current CLI help and website
status; a generic denial does not prove that claiming will fix the operation.

| Operation | Developer Agent / ownership requirement | Next action |
| --- | --- | --- |
| Source clone/bind/push, local dev, validation | Current Developer access; a human website Owner is not a prerequisite | Use the managed binding/Git path; resolve missing Developer access with an authorized human |
| Save dev/prod env | Current Developer Agent; no matching website Owner required | Save only the requested scope; Core encrypts it, and deployment applies prod values to the cloud |
| Read prod env values | Human website Owner; Developer responses remain masked | Use authorized dev-scope injection for local work; do not request prod plaintext to verify a write |
| Enable a cloud database | Developer capability plus explicit human database consent | Follow the database enable branch; database consent does not authorize deployment |
| Prepare deployment | Developer capability; owner may still be null | Validate and push first, then prepare one card for the intended commit |
| Confirm first deployment | Eligible human confirmation; may claim the website | Wait for the card result; ownership is established at confirmation, before cloud publication succeeds |
| Change visitor access | Website Owner's Developer Agent and a separately explicit visitor-audience request | Follow the access-policy branch; an unclaimed website may need an independent claim before safely publishing |
| Manage developers/viewers or transfer ownership | Human Owner or organization Admin, subject to operation-specific restrictions | Hand off the requested change; an Agent does not grant itself a role |
| Rollback or delete an owned website | Owner/Admin preparation and human confirmation | Use the authorized management path; do not loosen permissions to complete development |
| Delete an unclaimed draft | Developer may prepare; an eligible human confirms | Use the deletion flow only when deletion was requested |
| Write data through the platform database-record mutation API | Human website Owner | Keep this separate from app-local migrations and authorized database development; claiming does not make an Agent a human Owner |

## Independent ownership claim

`owner=null` is a valid draft. Configuration, source work, and deployment preparation can proceed
with Developer access. An independent claim is useful when the human explicitly wants ownership
before deployment, or an explicitly requested owner-dependent setup must happen before safe first
publication. A first deploy confirmation is the other supported claim path.

Before preparing a claim, read `syfo app claim --help`, confirm the website identity, check for an
existing pending claim card, and reuse the full current reply target:

```bash
syfo app claim <app-id> --target "<reply-target>" --json
```

The command prepares an `app:claim` card; it does not assign ownership by itself. Wait for an
eligible human to confirm. After a terminal result, re-read status to verify the actual Owner and
resume only the operation that is authorized for that actor. Claiming for an unrelated human does
not make the current Agent that Owner's Agent. The server decides who may confirm; do not promise
that every channel member is eligible, and do not issue duplicate cards while one is pending.

An env save does not automatically prepare a claim card. No deployment operation means deployment
claiming has not been triggered; independent claim cards are separate action-card records.

## Deployment and configuration are separate

Saving prod variables does not update the currently published runtime. The publish worker reads
Core's current variables and sends them to the cloud configuration. Save the requested variables
before preparing deployment, and disclose changes made after preparation to the confirming human;
an immutable source commit alone does not pin all environment settings. Do not use a deployment
as a way to obtain ownership or as a test that a variable was saved.

If an older server rejects Developer env writes, report the exact command/error and missing
capability. The existing human Owner/Admin management path remains available; use an independent
claim only within the legitimate ownership cases above, not as a retry or permission bypass.
