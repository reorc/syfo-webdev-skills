import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const legacy = await readFile(new URL('./syfo-webdev/references/legacy-app-maintenance.md', import.meta.url), 'utf8');

test('legacy maintenance is disclosed from the unified Skill', () => {
  assert.match(skill, /read `references\/legacy-app-maintenance\.md` before editing, validation, or deployment/);
  assert.match(skill, /positively identified historical static\/fullstack repositories follow the bundled legacy maintenance reference/);
  assert.match(skill, /static branch of `references\/legacy-app-maintenance\.md`/);
  assert.match(skill, /fullstack branch of `references\/legacy-app-maintenance\.md`/);
});

test('legacy reference is maintenance-only and preserves authoritative identity', () => {
  assert.match(legacy, /positively identified existing historical Syfo static or fullstack App/);
  assert.match(legacy, /Verify the existing historical App binding/);
  assert.match(legacy, /Hard stop: historical maintenance must never run `syfo app init`/);
  assert.match(legacy, /create a replacement App/);
  assert.match(legacy, /syfo app bind <app-id>/);
  assert.match(legacy, /syfo app clone <app-id> --clone <dir>/);
  assert.match(legacy, /\.git\/syfo-hosted-app\.json/);
  assert.match(legacy, /Existing App identity and canonical repository identity must agree/);
  assert.match(legacy, /Route all new Syfo website creation through the unified workflow/);
  assert.match(legacy, /never call `syfo app access set`/);
});

test('legacy static and fullstack resources remain bundled', async () => {
  for (const path of [
    './syfo-webdev/legacy/static/scripts/doctor.mjs',
    './syfo-webdev/legacy/static/scripts/smoke-static.mjs',
    './syfo-webdev/legacy/static/templates/project-static-server.mjs',
    './syfo-webdev/legacy/fullstack/scripts/doctor.mjs',
    './syfo-webdev/legacy/fullstack/scripts/smoke-server.mjs',
    './syfo-webdev/legacy/fullstack/templates/syfo.nextjs-fullstack.yaml',
  ]) {
    await access(new URL(path, import.meta.url), constants.R_OK);
  }
});

test('legacy maintenance keeps migration and deployment consent separate', () => {
  assert.match(legacy, /migration proposal, not permission to migrate/);
  assert.match(legacy, /separate explicit human decision/);
  assert.match(legacy, /independent database\/deployment authorization/);
  assert.match(legacy, /`build_only`/);
  assert.match(legacy, /`deploy_ready`/);
  assert.match(legacy, /`deploy_authorized`/);
  assert.match(legacy, /actual deployment always requires human confirmation/);
  assert.match(legacy, /Do not append raw CLI JSON or an internal audit object by default/);
});
