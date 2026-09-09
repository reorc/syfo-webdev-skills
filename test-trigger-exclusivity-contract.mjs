import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fixtures = JSON.parse(
  await readFile(new URL('./syfo-webdev/evals/trigger-evals.json', import.meta.url), 'utf8'),
);

test('one Skill owns unified and historical App routing', () => {
  for (const query of [
    '新建一个 Syfo Hosted App 官网，使用 unified site，不要数据库。',
    'Create a new Syfo app with the unified app preset and TiDB.',
    '从官方模板新建一个静态 Syfo 网站，app init 超时后继续恢复。',
    '从官方模板新建一个带登录和 TiDB 的 Syfo App，app init 超时后继续恢复。',
    '这是旧 web-static App，保持 legacy static 修复 adapter。',
    '这是旧 web-fullstack App，保持 legacy fullstack 修复 migration。',
    '这个 Syfo 仓库的 static/fullstack markers 冲突，先判断类型，不要修改。',
    '我想做一个网站。',
    '做一个普通网站，部署目标暂时不确定。',
  ]) {
    const matches = fixtures.filter((entry) => entry.query === query);
    assert.equal(matches.length, 1, `syfo-webdev must define the shared prompt exactly once: ${query}`);
    assert.equal(matches[0].should_trigger, true, `syfo-webdev must own: ${query}`);
  }
});

test('explicit non-Syfo delivery prompts stay outside syfo-webdev', () => {
  for (const query of [
    '给我一个可以直接打开的单文件 HTML 页面，不需要部署。',
    '在 syfo-web 产品仓库实现搜索功能，不涉及 Hosted App 托管。',
  ]) {
    const matches = fixtures.filter((entry) => entry.query === query);
    assert.equal(matches.length, 1, `missing generic negative: ${query}`);
    assert.ok(matches.every(({ should_trigger }) => should_trigger === false));
  }
});
