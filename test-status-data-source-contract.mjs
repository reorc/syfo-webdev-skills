import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const evals = JSON.parse(
  await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'),
);

test('point-in-time public-domain availability remains a supported positive path', () => {
  assert.match(skill, /\*\*Point-in-time availability\*\*/);
  assert.match(skill, /directly request the deployed public domain/);
  assert.match(skill, /checked URL, check time, and observed HTTP or page result/);
  assert.match(skill, /do not block it merely because no monitoring feed exists/);
  assert.match(skill, /does not prove\s+continuous uptime, history, Agent liveness, or Agent activity/);
});

test('continuous and historical status stop when no repeatable source exists', () => {
  assert.match(skill, /\*\*Continuous monitoring\*\*/);
  assert.match(skill, /\*\*Historical or activity status\*\*/);
  assert.match(skill, /require a real source that can be consumed\s+repeatedly/);
  assert.match(skill, /stop\s+before initializing, implementing, or deploying/);
  assert.match(skill, /best-effort active log/);
  assert.match(skill, /missing or stale row does not prove/);
  assert.match(skill, /Never invent\s+a telemetry token, environment variable, API, permission path/);
});

test('multiple requested business facts cannot be collapsed into an easier proxy', () => {
  assert.match(skill, /Preserve each business fact the human requested/);
  assert.match(skill, /do not replace a claim\s+with an easier proxy/);
  assert.match(skill, /collapse several claims into one generic status/);
  assert.match(skill, /Report the missing source for that specific claim/);
});

test('authorization guidance consumes structured facts without embedding a role matrix', () => {
  assert.match(skill, /structured status, authorization, and access results as authoritative/);
  assert.match(skill, /without recreating a role matrix in this Skill/);
  assert.match(skill, /If no verified executable path\s+is returned, report the boundary/);
  assert.doesNotMatch(skill, /env\.manage/);
  assert.doesNotMatch(skill, /explicit Developer/);
  assert.doesNotMatch(skill, /human App owner or Organization admin/);
});

test('evals cover public access, missing sources, and the real multi-claim regression', () => {
  const byId = new Map(evals.evals.map((entry) => [entry.id, entry]));
  for (const id of [12, 13, 14, 15, 16]) assert.ok(byId.has(id), `missing eval ${id}`);
  assert.match(byId.get(12).prompt, /公网域名/);
  assert.match(byId.get(12).expected_output, /point-in-time request/);
  assert.match(byId.get(13).prompt, /持续监控/);
  assert.match(byId.get(13).prompt, /没有任何 API、事件或日志数据源/);
  assert.match(byId.get(13).expected_output, /stops before initialization or deployment/);
  assert.match(byId.get(14).expected_output, /best-effort active logs/);
  assert.match(byId.get(15).expected_output, /does not recreate a role matrix/);
  assert.match(byId.get(16).prompt, /美团登录状态/);
  assert.match(byId.get(16).prompt, /Agent 的操作结果/);
  assert.match(byId.get(16).expected_output, /preserves both requested business facts/);
  assert.match(byId.get(16).expected_output, /stops instead of narrowing the request/);
  assert.match(byId.get(16).expected_output, /generic Agent heartbeat telemetry/);
});
