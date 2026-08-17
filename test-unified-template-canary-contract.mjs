import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateUnifiedTemplateContract } from './scripts/test-unified-template-canary.mjs';

async function fixture({ manifestId = 'web-unified', required = 'false', templateId = 'web-unified', kind = 'unified' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'syfo-unified-canary-contract-'));
  await mkdir(join(root, 'scripts'), { recursive: true });
  await writeFile(join(root, 'package.json'), `${JSON.stringify({
    private: true,
    packageManager: 'npm@10.9.4',
    engines: { node: '>=20.9.0' },
    scripts: {
      lint: 'eslint .',
      typegen: 'next typegen',
      typecheck: 'tsc --noEmit',
      'check:fast': 'npm run typegen && npm run typecheck && npm run lint && npm test',
      test: 'node --test',
      build: 'next build',
      'db:migrate': 'tsx db/migrate.ts',
    },
    dependencies: { next: '16.3.0', mysql2: '3.23.1' },
  }, null, 2)}\n`);
  await writeFile(join(root, '.gitignore'), 'next-env.d.ts\n');
  await writeFile(join(root, 'next.config.ts'), 'export default { output: "standalone" };\n');
  await writeFile(join(root, 'proxy.ts'), 'export default async function proxy() {}\n');
  await writeFile(join(root, 'syfo.yaml'), `version: 1\ntemplate:\n  id: ${manifestId}\ndatabase:\n  engine: tidb\n  required: ${required}\n`);
  await writeFile(join(root, 'template.json'), `${JSON.stringify({ id: templateId, kind })}\n`);
  return root;
}

test('unified canary accepts web-unified optional-database baseline', async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await validateUnifiedTemplateContract(root), {
      nextVersion: '16.3.0', packageManager: 'npm@10.9.4', nodeEngine: '>=20.9.0',
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('unified canary rejects legacy or database-required baseline markers', async () => {
  const legacy = await fixture({ manifestId: 'web-fullstack' });
  const required = await fixture({ required: 'true' });
  try {
    await assert.rejects(validateUnifiedTemplateContract(legacy), /template.id: web-unified/);
    await assert.rejects(validateUnifiedTemplateContract(required), /database.required: false/);
  } finally {
    await rm(legacy, { recursive: true, force: true });
    await rm(required, { recursive: true, force: true });
  }
});

test('unified canary requires generated route types in the fast gate', async () => {
  const root = await fixture();
  try {
    const packagePath = join(root, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.scripts.typegen = 'echo skipped';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    await assert.rejects(validateUnifiedTemplateContract(root), /typegen script must run next typegen/);

    packageJson.scripts.typegen = 'next typegen';
    packageJson.scripts['check:fast'] = 'npm run typecheck && npm test';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    await assert.rejects(validateUnifiedTemplateContract(root), /check:fast must run typegen before typecheck/);

    packageJson.scripts['check:fast'] = 'npm run typecheck && npm run typegen && npm test';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    await assert.rejects(validateUnifiedTemplateContract(root), /check:fast must run typegen before typecheck/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
