import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const unified = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const staticSkill = await readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8');
const fullstackSkill = await readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8');

test('unified create contract accepts only frozen pairs', () => {
  assert.match(unified, /--template unified --preset site --from-template --clone <dir>/);
  assert.match(unified, /--template unified --preset app --confirm-tidb --from-template --clone <dir>/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--preset site[^\n]*--confirm-tidb/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--database/);
  assert.doesNotMatch(unified, /legacy `template=[^`]*nextjs/);
  assert.match(unified, /daemon sends the complete Core pair `site\/none`/);
  assert.match(unified, /daemon sends the complete Core pair `app\/tidb`/);
  assert.match(unified, /Do not expose or pass `--database`, infer a preset from feature prose/);
  assert.match(unified, /[Tt]he human's informed App selection or explicit TiDB App request is the single confirmation/);
  assert.match(unified, /selection of App after that disclosure is the required confirmation/);
  assert.match(unified, /initial explicit request for a TiDB-backed App or informed `preset=app` selection also counts as confirmation/);
  assert.match(unified, /never requires a second confirmation prompt/);
  assert.match(unified, /Never ask twice when that choice already confirms TiDB provisioning/);
  assert.match(unified, /Never pass `--confirm-tidb` for `preset=site` or without an informed explicit App\/TiDB choice/);
});

test('legacy aliases preserve flow and require explicit upgrade consent', () => {
  for (const source of [staticSkill, fullstackSkill]) {
    assert.match(source, /legacy compatibility/i);
    assert.match(source, /Preserve the old/);
    assert.match(source, /separate explicit human authorization|separate human consent/);
  }
  assert.match(unified, /Detection is read-only\. A classification result is not migration consent/);
  assert.match(unified, /Never infer `none -> tidb`/);
  assert.match(unified, /only Skill for creating a website or App whose selected delivery target is Syfo Hosted App/i);
  assert.match(unified, /compatibility aliases for historical Apps only/);
  assert.match(staticSkill, /Do not use for any new website or App/);
  assert.match(fullstackSkill, /Do not use for any new website or App/);
});

test('uncertain Syfo requests ask once before choosing a template or mutating', () => {
  assert.match(unified, /If the request says only “new Syfo website\/App”.*ask once/s);
  assert.match(unified, /`unknown`.*Ask the minimum focused question/s);
  assert.match(unified, /do not begin implementation, choose a template, initialize, migrate, enable a database, or deploy meanwhile/);
});

test('generic website creation enters routing without treating names as hosting intent', () => {
  assert.match(unified, /daemon-injected runtime context identifies the agent as running in Syfo/i);
  assert.match(unified, /new website, web app, landing page, dashboard, or interactive browser experience without specifying a delivery target/i);
  assert.match(unified, /Do you want local\/source-only delivery, or should I create and host it as a Syfo Hosted App\?/);
  assert.match(unified, /Do not activate merely because a repository, product, package, team, feature, organization/i);
  assert.match(unified, /“implement Syfo Web search” or “fix the Syfo website login” are ordinary product-development work/);
  assert.match(unified, /Consulting this Skill is not authorization to initialize, provision TiDB, migrate, deploy, or change access policy/);
});

test('evals distinguish informed App consent from an ambiguous new-App request', async () => {
  const evals = JSON.parse(await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'));
  const explicitTidb = evals.evals.find(({ id }) => id === 2);
  const ambiguousCreate = evals.evals.find(({ id }) => id === 5);

  assert.match(explicitTidb.expected_output, /single informed confirmation/);
  assert.match(explicitTidb.expected_output, /does not ask again/);
  assert.match(ambiguousCreate.expected_output, /asks once/);
  assert.match(ambiguousCreate.expected_output, /choice is the confirmation/);
  assert.match(ambiguousCreate.expected_output, /without asking again/);
});

test('trigger matrix covers unified, legacy, ambiguous, and no-consent database request', async () => {
  const triggers = JSON.parse(await readFile(new URL('./syfo-webdev/evals/trigger-evals.json', import.meta.url), 'utf8'));
  const cases = [
    [/unified site/, true],
    [/unified app preset/, true],
    [/旧 web-static App/, false],
    [/旧 web-fullstack App/, false],
    [/markers 冲突/, true],
    [/还没授权迁移或启用 TiDB/, true],
    [/^我想做一个网站。$/, true],
    [/部署目标暂时不确定/, true],
    [/syfo-web 产品仓库实现搜索功能/, false],
  ];
  for (const [pattern, expected] of cases) {
    assert.ok(
      triggers.some(({ query, should_trigger }) => should_trigger === expected && pattern.test(query)),
      `missing trigger case ${pattern} => ${expected}`,
    );
  }
  assert.match(unified, /Ambiguous.*Stop and ask/s);
  assert.match(unified, /Feature requirements are not treated as migration consent|Requests such as “add login,”/);
});
