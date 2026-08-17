import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const unified = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const legacy = await Promise.all([
  readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8'),
  readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8'),
]);

function frontmatterDescription(source) {
  const match = source.match(/^description: "(.*)"$/m);
  assert.ok(match, 'Skill frontmatter must have a quoted description');
  return match[1];
}

const unifiedDescription = frontmatterDescription(unified);
const legacyDescriptions = legacy.map(frontmatterDescription);

test('unified Skill owns new website init and ambiguous recovery discipline', () => {
  assert.match(unified, /syfo app init <name> --template unified --preset site --from-template --clone <dir>/);
  assert.match(unified, /syfo app init <name> --template unified --preset app --confirm-tidb --from-template --clone <dir>/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--preset site[^\n]*--confirm-tidb/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--database/);
  assert.match(unified, /daemon sends the complete Core pair `site\/none`/);
  assert.match(unified, /daemon sends the complete Core pair `app\/tidb`/);
  assert.match(unified, /default to the website-without-database path/);
  assert.match(unified, /legacy phrase “Syfo Hosted App” as TiDB consent/);
  assert.match(unified, /explicit TiDB request or a yes after this disclosure is the single informed confirmation/);
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

test('all Skill descriptions route missing machine-local bindings to bind or clone', () => {
  for (const description of [unifiedDescription, ...legacyDescriptions]) {
    assert.match(description, /machine-local binding is missing/);
    assert.match(description, /syfo app bind <app-id>/);
    assert.match(description, /syfo app clone <app-id> --clone <dir>/);
    assert.match(description, /never rerun syfo app init/);
    assert.match(description, /never .*copy \.git\/syfo-hosted-app\.json from another machine or Agent/);
  }
});

test('legacy Skill descriptions limit binding recovery to identified historical Apps', () => {
  for (const description of legacyDescriptions) {
    assert.match(description, /positively identified existing historical Syfo (?:static|fullstack) App/);
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
