import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateFullstackTemplateContract } from './scripts/test-fullstack-template-canary.mjs';

async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'syfo-fullstack-canary-contract-'));
  await mkdir(join(root, 'scripts'), { recursive: true });
  const packageJson = {
    private: true,
    packageManager: 'npm@10.9.4',
    engines: { node: '>=20.9.0' },
    scripts: {
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      test: 'node --test',
      build: 'next build',
      'db:migrate': 'tsx db/migrate.ts',
    },
    dependencies: { next: '16.3.0', mysql2: '3.23.1' },
    ...overrides,
  };
  await writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(root, '.gitignore'), 'next-env.d.ts\n');
  await writeFile(join(root, 'next.config.ts'), 'export default { output: "standalone" };\n');
  await writeFile(join(root, 'proxy.ts'), 'export default async function proxy() {}\n');
  return root;
}

test('fullstack template canary accepts the Next.js 16 contract', async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await validateFullstackTemplateContract(root), {
      nextVersion: '16.3.0',
      packageManager: 'npm@10.9.4',
      nodeEngine: '>=20.9.0',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fullstack template canary rejects old Node and obsolete webpack config', async () => {
  const oldNode = await fixture({ engines: { node: '>=20.8.0' } });
  const webpack = await fixture();
  await writeFile(join(webpack, 'next.config.ts'), 'export default { output: "standalone", webpack: () => ({}) };\n');
  try {
    await assert.rejects(validateFullstackTemplateContract(oldNode), /Expected engines\.node >=20\.9\.0/);
    await assert.rejects(validateFullstackTemplateContract(webpack), /obsolete edge webpack workaround/);
  } finally {
    await rm(oldNode, { recursive: true, force: true });
    await rm(webpack, { recursive: true, force: true });
  }
});
