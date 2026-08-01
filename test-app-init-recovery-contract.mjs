import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const cases = [
  {
    skill: 'syfo-webdev-static',
    template: 'static',
  },
  {
    skill: 'syfo-webdev-fullstack',
    template: 'fullstack',
  },
];

for (const entry of cases) {
  test(`${entry.skill} owns template clone and recovery discipline`, async () => {
    const source = await readFile(join(entry.skill, 'SKILL.md'), 'utf8');

    assert.match(
      source,
      new RegExp(
        `syfo app init <name> --template ${entry.template} --from-template --clone <dir>`,
      ),
    );
    assert.match(source, /daemon CLI owns the authenticated Git clone/u);
    assert.match(source, /Do not run a separate\s+`git clone`/u);
    assert.match(source, /reports `app initialized`/u);
    assert.match(source, /non-empty `cloneDir`/u);
    assert.match(source, /local binding path/u);
    assert.match(source, /Then `cd <cloneDir>`/u);
    assert.match(source, /syfo app init --resume <commandId>/u);
    assert.match(source, /Do not rerun the\s+original init command with a new idempotency key/u);
    assert.match(source, /overwrite a partial clone/u);
    assert.match(source, /both the API and local Git sync succeed/u);
  });
}
