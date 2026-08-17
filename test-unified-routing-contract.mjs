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
  assert.match(unified, /New Syfo(?:-hosted)? websites default to no database/i);
  assert.match(unified, /Do not ask the user to choose “Site” versus “App/);
  assert.match(unified, /legacy phrase “Syfo Hosted App” as cloud-database consent/);
  assert.match(unified, /request for a database, cloud database, or TiDB.*single informed confirmation/);
  assert.match(unified, /never requires a second confirmation prompt/);
  assert.match(unified, /Never ask twice when the user already approved database provisioning/);
  assert.match(unified, /Never pass `--confirm-tidb` for `preset=site` or without informed explicit cloud-database consent/);
});

test('legacy aliases preserve flow and require explicit upgrade consent', () => {
  for (const source of [staticSkill, fullstackSkill]) {
    assert.match(source, /legacy compatibility/i);
    assert.match(source, /Preserve the old/);
    assert.match(source, /separate explicit human authorization|separate human consent/);
  }
  assert.match(unified, /Detection is read-only\. A classification result is not migration consent/);
  assert.match(unified, /Never infer `none -> tidb`/);
  assert.match(unified, /Create and maintain Syfo-hosted websites/i);
  assert.match(unified, /compatibility aliases for historical Apps only/);
  assert.match(staticSkill, /Do not use for any new website or App/);
  assert.match(fullstackSkill, /Do not use for any new website or App/);
});

test('existing unified site database enable uses one consent and preserves lifecycle boundaries', () => {
  assert.match(unified, /Only the exact `preset=site,database=none` state can use the database-enable flow/);
  assert.match(unified, /syfo app database enable \[app-id\] --confirm-tidb/);
  assert.match(unified, /that is the single informed confirmation\. Do not ask again/);
  assert.match(unified, /does not modify source, validate, deploy, change the live version, domain, or access policy/);
  assert.match(unified, /After `state=enabled` or `state=already_enabled`/);
  assert.match(unified, /exact internal unified `app\/tidb` state with an active database binding/);
  assert.match(unified, /Modify the same original repository for cloud-database usage, including `database.required: true`/);
  assert.match(unified, /Database consent is not deploy consent/);
  assert.match(unified, /do not edit the repository as though the transition succeeded/);
  assert.match(unified, /Do not use `syfo app database enable` for a legacy App/);
});

test('Syfo hosting defaults to no database while persistence asks for cloud database consent', () => {
  assert.match(unified, /When the user selects Syfo hosting without explicitly requesting or approving a database, default to the website-without-database path/);
  assert.match(unified, /If the requested functionality requires persistence.*one focused consent question/s);
  assert.match(unified, /是否为它启用 Syfo 云数据库/);
  assert.match(unified, /Should I enable a Syfo cloud database for it\?/);
  assert.doesNotMatch(unified, /Should I enable TiDB\?|是否.*启用 TiDB/);
  assert.match(unified, /`unknown`.*Ask the minimum focused question/s);
  assert.match(unified, /do not begin implementation, initialize, migrate, enable a database, or deploy meanwhile/);
});

test('generic website creation enters routing without treating names as hosting intent', () => {
  assert.match(unified, /daemon-injected runtime context identifies the agent as running in Syfo/i);
  assert.match(unified, /new website, web app, landing page, dashboard, or interactive browser experience without specifying a delivery target/i);
  assert.match(unified, /Do you want local\/source-only delivery, or should I create and host it as a Syfo website\?/);
  assert.match(unified, /Do not activate merely because a repository, product, package, team, feature, organization/i);
  assert.match(unified, /“implement Syfo Web search” or “fix the Syfo website login” are ordinary product-development work/);
  assert.match(unified, /Consulting this Skill is not authorization to initialize, provision a cloud database, migrate, deploy, or change access policy/);
});

test('evals distinguish explicit TiDB consent from generic Syfo hosting', async () => {
  const evals = JSON.parse(await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'));
  const explicitTidb = evals.evals.find(({ id }) => id === 2);
  const ambiguousCreate = evals.evals.find(({ id }) => id === 5);

  assert.match(explicitTidb.expected_output, /single informed database confirmation/);
  assert.match(explicitTidb.expected_output, /persistence capability a cloud database/);
  assert.match(explicitTidb.expected_output, /does not ask again/);
  assert.match(ambiguousCreate.expected_output, /defaults to a Syfo-hosted website without a database/);
  assert.match(ambiguousCreate.expected_output, /does not ask the user to choose Site versus App/);
  assert.match(ambiguousCreate.expected_output, /legacy wording.*does not authorize a database/i);
});

test('evals cover explicit and missing consent for existing unified site upgrade', async () => {
  const evals = JSON.parse(await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'));
  const explicitUpgrade = evals.evals.find(({ id }) => id === 7);
  const missingConsent = evals.evals.find(({ id }) => id === 8);

  assert.match(explicitUpgrade.expected_output, /single informed cloud-database confirmation/);
  assert.match(explicitUpgrade.expected_output, /without asking twice/);
  assert.match(explicitUpgrade.expected_output, /same repository/);
  assert.match(explicitUpgrade.expected_output, /does not rerun init or deploy/);
  assert.match(missingConsent.expected_output, /does not authorize database enablement/);
  assert.match(missingConsent.expected_output, /provider-neutral Syfo cloud-database consent question/);
  assert.match(missingConsent.expected_output, /no Syfo database or deployment mutation/);
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
    [/unified site\/none 要启用 TiDB/, true],
    [/unified site 的新功能要存数据/, true],
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
