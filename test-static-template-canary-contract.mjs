import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateTemplateContract } from './scripts/test-static-template-canary.mjs';

async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'syfo-static-canary-contract-'));
  const packageJson = {
    private: true,
    packageManager: 'npm@10.9.4',
    engines: { node: '>=20.9.0' },
    scripts: { lint: 'eslint .', typecheck: 'tsc --noEmit', test: 'node --test', build: 'next build' },
    dependencies: { next: '16.3.0' },
    ...overrides,
  };
  await writeFile(join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(root, '.gitignore'), 'next-env.d.ts\n');
  return root;
}

test('static template canary accepts the Next.js 16 contract', async () => {
  const root = await fixture();
  try {
    assert.deepEqual(await validateTemplateContract(root), {
      nextVersion: '16.3.0',
      packageManager: 'npm@10.9.4',
      nodeEngine: '>=20.9.0',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('static template canary rejects an incompatible Next.js or Node contract', async () => {
  const next15 = await fixture({ dependencies: { next: '15.5.21' } });
  const oldNode = await fixture({ engines: { node: '>=20.8.0' } });
  try {
    await assert.rejects(validateTemplateContract(next15), /Expected Next\.js 16\.x/);
    await assert.rejects(validateTemplateContract(oldNode), /Expected engines\.node >=20\.9\.0/);
  } finally {
    await rm(next15, { recursive: true, force: true });
    await rm(oldNode, { recursive: true, force: true });
  }
});
