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
  assert.match(unified, /syfo app init <name> --template unified --preset app --confirm-tidb --from-template --clone <dir>/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--preset site[^\n]*--confirm-tidb/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--database/);
  assert.match(unified, /maps site to the Core site\/none pair and app to app\/tidb/);
  assert.match(unified, /selection of App after that disclosure is the required confirmation/);
  assert.match(unified, /initial explicit request for a TiDB-backed App or informed `preset=app` selection also counts as confirmation/);
  assert.match(unified, /never requires a second confirmation prompt/);
  assert.match(unified, /syfo app init --resume <commandId>/);
  assert.match(unified, /Never rerun init, generate a new idempotency key, or manually clone/);
});

test('all Skills recover existing App bindings without reinitializing or copying credentials', () => {
  for (const source of [unified, ...legacy]) {
    assert.match(source, /\.git\/syfo-hosted-app\.json/);
    assert.match(source, /syfo app bind <app-id>/);
    assert.match(source, /syfo app clone <app-id> --clone <dir>/);
    assert.match(source, /must never be committed or copied|must never be committed, copied/);
    assert.match(source, /\.syfo\/app\.json/);
    assert.match(source, /Never (?:use|run) `syfo app init` to (?:repair|recover) a missing binding|Never run `syfo app init` to recover an existing App/);
  }
});

test('legacy Skills require authoritative existing Apps and never initialize new ones', () => {
  for (const source of legacy) {
    assert.match(source, /Verify the existing historical App binding/);
    assert.match(source, /Existing App identity and canonical repository identity agree/);
    assert.match(source, /Route new creation to `syfo-webdev`/);
    for (const line of source.split('\n').filter((value) => /syfo app init/i.test(value))) {
      assert.match(line, /does not|do not|must not|never|refus|rather than/i);
    }
  }
});
