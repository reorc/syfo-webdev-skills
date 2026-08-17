import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const localValidation = await readFile(
  new URL('./syfo-webdev/references/local-validation.md', import.meta.url),
  'utf8',
);
const deployment = await readFile(
  new URL('./syfo-webdev/references/deployment-lifecycle.md', import.meta.url),
  'utf8',
);

test('unified Skill defines bounded fast, production, and diagnostic validation modes', () => {
  for (const mode of ['fast', 'production', 'diagnostic_exception']) {
    assert.ok(skill.includes(`\`${mode}\``), `Skill is missing ${mode}`);
    assert.ok(localValidation.includes(`\`${mode}\``), `local validation is missing ${mode}`);
  }
  assert.match(skill, /bare `tsc --noEmit` is[\s\S]*insufficient/);
  assert.match(localValidation, /next typegen[\s\S]*tsc --noEmit/);
  assert.match(localValidation, /production bundle[\s\S]*standalone artifact[\s\S]*static generation/);
});

test('cloud build diagnosis is operation-first and does not create a second deploy', () => {
  assert.match(deployment, /syfo app operation <operation-id> --app-id <app-id> --json/);
  assert.match(deployment, /one `diagnostic_exception` production run/);
  assert.match(deployment, /Never create another deploy operation merely to obtain logs/);
  assert.match(deployment, /syfo app status <app-id> --json[\s\S]*syfo app versions <app-id> --json/);
});

test('normal immutable source push uses the binding-aware CLI', () => {
  assert.match(skill, /syfo app push --remote syfo --branch main --json/);
  assert.match(skill, /Do not substitute `syfo app git-auth -- push/);
});

test('handoff separates executed, skipped, and cloud-owned checks', () => {
  assert.match(skill, /Selected validation mode and why it applied/);
  assert.match(skill, /Checks intentionally skipped/);
  assert.match(skill, /Checks still delegated to the Syfo clean Builder/);
});
