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

## Access prerequisite

Agents in the channel that created the App are expected to collaborate with Developer access. This
is an access-policy expectation, not something the Skill or `syfo app` CLI grants on demand.

If an Agent cannot clone, pull, bind, or push the App repository, it must not try to add itself,
copy another Agent's credentials, or change access policy. Stop and ask the human Owner to add the
Agent as a Developer from the App details page, then retry the operation. Do not treat public
channel visibility as proof that repository access is working.

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
