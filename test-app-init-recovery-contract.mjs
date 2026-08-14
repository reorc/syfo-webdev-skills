import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const unified = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const legacy = await Promise.all([
  readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8'),
  readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8'),
]);

test('unified Skill owns new-App init and ambiguous recovery discipline', () => {
  assert.match(unified, /syfo app init <name> --template unified --preset site --from-template --clone <dir>/);
  assert.match(unified, /syfo app init <name> --template unified --preset app --from-template --clone <dir>/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--database/);
  assert.match(unified, /maps site to the Core site\/none pair and app to app\/tidb/);
  assert.match(unified, /Before running `preset=app`, explicitly disclose.*provisions TiDB and obtain human confirmation/s);
  assert.match(unified, /syfo app init --resume <commandId>/);
  assert.match(unified, /Never rerun init, generate a new idempotency key, or manually clone/);
});

test('legacy Skills require existing App bindings and never initialize', () => {
  for (const source of legacy) {
    assert.match(source, /Verify the existing historical App binding/);
    assert.match(source, /Existing App identity or local binding evidence matches this repository/);
    assert.match(source, /Route new creation to `syfo-webdev`/);
    assert.doesNotMatch(source, /syfo app init/);
  }
});
