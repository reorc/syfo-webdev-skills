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
    name: 'old static create wording routes unified',
    query: '从官方模板新建一个静态 Syfo 网站，app init 超时后继续恢复。',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'old fullstack create wording routes unified',
    query: '从官方模板新建一个带登录和 TiDB 的 Syfo App，app init 超时后继续恢复。',
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
  {
    name: 'new Syfo pair undecided',
    query: '新建一个 Syfo 网站，但我没决定 site 还是 app、要不要数据库。',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'Syfo delivery target undecided',
    query: '我想做一个网站，可能部署 Syfo，也可能只要 HTML，还没决定。',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'generic website enters delivery routing',
    query: '我想做一个网站。',
    expected: { unified: true, static: false, fullstack: false },
  },
  {
    name: 'generic website target unspecified',
    query: '做一个普通网站，部署目标暂时不确定。',
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

test('explicit non-Syfo delivery prompts do not auto-trigger a Syfo Skill', () => {
  for (const query of [
    '给我一个可以直接打开的单文件 HTML 页面，不需要部署。',
    '在 syfo-web 产品仓库实现搜索功能，不涉及 Hosted App 托管。',
  ]) {
    for (const [skill, entries] of Object.entries(fixtures)) {
      const matches = entries.filter((entry) => entry.query === query);
      assert.equal(matches.length, 1, `${skill} must define generic negative: ${query}`);
      assert.ok(matches.every(({ should_trigger }) => should_trigger === false));
    }
  }
});
