import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skills = [
  [
    'static',
    await readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8'),
    await readFile(new URL('./syfo-webdev-static/evals/evals.json', import.meta.url), 'utf8'),
  ],
  [
    'fullstack',
    await readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8'),
    await readFile(new URL('./syfo-webdev-fullstack/evals/evals.json', import.meta.url), 'utf8'),
  ],
];

test('legacy Skill bodies are maintenance-only', () => {
  for (const [name, source] of skills) {
    assert.match(source, /existing historical App binding/);
    assert.match(source, /Never create a replacement App/);
    assert.match(source, /Route new creation to `syfo-webdev`/);
    assert.doesNotMatch(source, new RegExp(`syfo app init[^\n]*--template ${name}`));
    assert.doesNotMatch(source, /syfo app init/);
    assert.doesNotMatch(source, /brand-new|new Syfo Hosted App|new official-template Apps/i);
    assert.doesNotMatch(source, /For an existing local Git project.*platform creates/s);
  }
});

test('legacy eval expectations never prescribe legacy App creation', () => {
  for (const [name, , evalSource] of skills) {
    const { evals } = JSON.parse(evalSource);
    const expectations = evals.flatMap((evaluation) => [
      evaluation.expected_output,
      ...evaluation.expectations,
    ]).join('\n');

    for (const line of expectations.split('\n').filter((value) => /syfo app init/i.test(value))) {
      assert.match(line, /does not|do not|must not|never|refus/i);
    }
    assert.doesNotMatch(expectations, new RegExp(`--template ${name}`));
    assert.doesNotMatch(expectations, /new official-template App|official-template default/i);
    assert.doesNotMatch(expectations, /(?:static|fullstack) skill initializes/i);
  }
});
