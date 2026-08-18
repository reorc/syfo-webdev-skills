# Multi-agent source collaboration

Use this lightweight protocol when several Agents contribute to one Syfo-hosted website. It avoids
requiring MR support in the Syfo CLI or a locally installed GitLab CLI.

## Roles

Assign one **integration Agent** before implementation begins. The integration Agent owns the
integration worktree and is the only Agent allowed to push `main`, `develop`, or the agreed
integration branch.

Other Agents are **source collaborators**. They implement disjoint tasks and push their own
namespaced branches for the integration Agent to review and merge. This is a coordination protocol,
not a new protected-branch or CLI enforcement mechanism.

## Source-channel authorization (proposed Core capability)

The current Syfo CLI and Skill do **not** grant App Developer access. Agents still need an existing
Owner/Developer grant before they can clone, bind, push, or otherwise modify an App. Do not use
Skill instructions or channel membership to bypass that authorization.

If Core later implements the proposed resolver, `hosted_apps.source_channel_id` can identify the
channel from which the website was created. Active Agent members of that source channel could then
receive Developer access dynamically so Agents already collaborating in the public channel can
work on the same App without individual grants. This is a target-state contract, not an available
CLI capability today.

Under that future implementation, treat channel membership as the source of truth. Do not copy every
Agent into the persisted App member table: doing so duplicates membership state, requires join/leave
synchronization, and creates an approval problem before ownership is claimed. Resolve the effective
Developer role at request time from the App's source channel and the Agent's current active channel
membership. This would work from App creation onward and would not depend on `claim` or first
deployment.

The future App detail UI may show these entries in a read-only **Source channel collaborators**
section, or merge them into the member projection with `derived=true` and `source=source_channel`.
They would not be persisted member grants and therefore would not need an approval card. Explicit
Owner/Developer grants remain separate persisted relationships. Until Core and the UI implement
this, do not promise the section or dynamic access in a user-facing handoff.

If Core implements this proposal, do not reuse a read-only source-channel visibility check as the
write authorization decision. Keep the dynamic Developer resolver explicit, require a current
`channel_members` row rather than public visibility alone, and audit the derived reason as
`derived_from_source_channel`.

## Branch protocol

Each task gets one branch using the Agent and task namespace:

```text
agent/<agent-name>/<task-number>-<slug>
```

As a soft collaboration rule, contributors should not share a worktree or push another Agent's
branch. They should leave `main`, `develop`, and the agreed integration branch to the integration
Agent. Keep the task branch based on the integration revision recorded at task start. If the
integration branch moves, rebase or merge from it in the task branch and report the new base
revision.

## Handoff and integration

When a task is ready, the source collaborator sends the integration Agent:

- branch name;
- commit SHA and base SHA;
- concise changed-file and behavior summary;
- validation commands and results;
- known conflicts, generated files, migrations, or follow-up risks.

The integration Agent fetches the branch into its own bound worktree, reviews the diff, resolves
conflicts once, runs the relevant checks, and creates the integration commit. The integration Agent
then pushes the integration branch and records the final SHA in the task thread. No MR is required
for this protocol; a GitLab MR can be added later by a human if governance requires one.

## Binding and credential safety

Every machine or Agent uses its own `syfo app bind` or `syfo app clone` flow. Never copy
`.git/syfo-hosted-app.json`, short-lived Git credentials, tokens, or another Agent's binding. A
source collaborator hands off a branch and immutable SHA, not credentials or a local worktree.

## Minimal checklist

- [ ] Integration Agent and integration branch are recorded.
- [ ] Every collaborator has a unique `agent/<agent-name>/...` branch.
- [ ] Collaborators leave the integration branch to the integration Agent.
- [ ] Every handoff includes branch, commit SHA, base SHA, and checks.
- [ ] Only the integration Agent resolves conflicts and pushes the integration branch.
- [ ] Deployment and access-policy changes remain separately authorized by the owner/admin.
