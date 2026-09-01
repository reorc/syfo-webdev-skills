import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const evals = JSON.parse(
  await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'),
);

test('status pages prove a supported data source before mutation', () => {
  assert.match(skill, /before initialization, cloud-database consent, implementation, or\s+deployment/);
  assert.match(skill, /List every displayed fact and the exact source/);
  assert.match(skill, /best-effort active log/);
  assert.match(skill, /not a\s+passive heartbeat/);
  assert.match(skill, /does not currently provide a supported passive, continuous Agent self-monitoring/);
  assert.match(skill, /stop before initialization or deployment/);
  assert.match(skill, /Never invent a telemetry token, environment variable, API, permission path/);
});

test('authorization and correction rules preserve verified facts', () => {
  assert.match(skill, /`FORBIDDEN` means the requested capability was denied/);
  assert.match(skill, /`env\.manage` is restricted to a human App owner or Organization\s+admin/);
  assert.match(skill, /`login_required` under `org`, `org_members`/);
  assert.match(skill, /visitor's website session policy/);
  assert.match(skill, /no verified delegated action or executable entry point/);
  assert.match(skill, /invalidate\s+the old assumption immediately/);
  assert.match(skill, /without an operation record and its required terminal result/);
});

test('evals cover passive monitoring, best-effort logs, explicit Developer, and replanning', () => {
  const byId = new Map(evals.evals.map((entry) => [entry.id, entry]));
  for (const id of [12, 13, 14, 15]) assert.ok(byId.has(id), `missing eval ${id}`);
  assert.match(byId.get(12).prompt, /被动监控/);
  assert.match(byId.get(13).expected_output, /best-effort/);
  assert.match(byId.get(14).prompt, /explicit Developer/);
  assert.match(byId.get(14).prompt, /FORBIDDEN/);
  assert.match(byId.get(14).prompt, /login_required/);
  assert.match(byId.get(15).expected_output, /invalidates the old role and token assumptions/);
});
