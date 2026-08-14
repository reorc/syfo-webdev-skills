import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fixtures = Object.fromEntries(
  await Promise.all(
    [
      ['unified', './syfo-webdev/evals/trigger-evals.json'],
      ['static', './syfo-webdev-static/evals/trigger-evals.json'],
      ['fullstack', './syfo-webdev-fullstack/evals/trigger-evals.json'],
    ].map(async ([name, path]) => [
      name,
      JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')),
    ]),
  ),
);

const matrix = [
  {
    name: 'new unified site',
    query: '新建一个 Syfo Hosted App 官网，使用 unified site，不要数据库。',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'new unified app',
    query: 'Create a new Syfo app with the unified app preset and TiDB.',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'known legacy static',
    query: '这是旧 web-static App，保持 legacy static 修复 adapter。',
    expected: { unified: false, static: true, fullstack: false },
  },
  {
    name: 'known legacy fullstack',
    query: '这是旧 web-fullstack App，保持 legacy fullstack 修复 migration。',
    expected: { unified: false, static: false, fullstack: true },
  },
  {
    name: 'ambiguous markers',
    query: '这个 Syfo 仓库的 static/fullstack markers 冲突，先判断类型，不要修改。',
    expected: { unified: true, static: false, fullstack: false },
  },
];

test('trigger fixtures are mutually exclusive across unified and legacy Skills', () => {
  for (const scenario of matrix) {
    for (const [skill, expected] of Object.entries(scenario.expected)) {
      const matches = fixtures[skill].filter(({ query }) => query === scenario.query);
      assert.equal(matches.length, 1, `${scenario.name}: ${skill} must define the shared prompt exactly once`);
      assert.equal(matches[0].should_trigger, expected, `${scenario.name}: unexpected ${skill} routing`);
    }
    assert.equal(
      Object.values(scenario.expected).filter(Boolean).length,
      1,
      `${scenario.name}: exactly one Skill must own the prompt`,
    );
  }
});
