import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  DEFAULT_MAX_ARTIFACT_BYTES,
  analyzeArtifactTree,
} from './syfo-webdev-fullstack/scripts/check-artifact-budget.mjs';

const repositoryRoot = process.cwd();

async function file(root, path, content = 'x') {
  const target = join(root, path);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, content);
  return target;
}

test('artifact budget matches Builder byte and file boundaries', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'syfo-artifact-budget-'));
  try {
    await file(scratch, 'server.js', "console.log('ready')");
    await file(scratch, 'node_modules/next/index.js', 'next');
    const exactBoundary = analyzeArtifactTree(scratch, { maxBytes: 24, maxFiles: 2 });
    assert.equal(exactBoundary.ok, true);
    assert.equal(exactBoundary.fileCount, 2);
    assert.equal(exactBoundary.totalBytes, 24);
    assert.equal(exactBoundary.topN.runtimeDependenciesByBytes[0]?.path, 'node_modules/next');

    const oversized = join(scratch, 'oversized');
    const oversizedFile = await file(oversized, 'runtime.bin');
    await truncate(oversizedFile, DEFAULT_MAX_ARTIFACT_BYTES + 1);
    const oversizedReport = analyzeArtifactTree(oversized);
    assert.deepEqual(
      oversizedReport.violations.map((violation) => violation.code),
      ['builder_artifact_file_too_large', 'builder_artifact_tree_too_large'],
    );

    const tooMany = join(scratch, 'too-many');
    await file(tooMany, 'a');
    await file(tooMany, 'b');
    assert.equal(
      analyzeArtifactTree(tooMany, { maxFiles: 1 }).violations[0]?.code,
      'builder_artifact_too_many_files',
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('artifact budget identifies build-only and duplicate native variants', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'syfo-artifact-hints-'));
  try {
    await file(scratch, 'server.js');
    await file(scratch, 'node_modules/typescript/lib/tsc.js');
    await file(scratch, 'node_modules/@img/sharp-libvips-linux-x64/lib/libvips.so');
    await file(scratch, 'node_modules/@img/sharp-libvips-linuxmusl-x64/lib/libvips.so');
    assert.deepEqual(
      analyzeArtifactTree(scratch).hints.map((hint) => hint.code),
      ['artifact-build-only-dependencies', 'artifact-native-platform-variants'],
    );

    await symlink('server.js', join(scratch, 'alias.js'));
    assert.throws(() => analyzeArtifactTree(scratch), /artifact_budget_special_file:alias\.js/);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('fullstack doctor blocks an oversized assembled artifact before deploy', async () => {
  const project = await mkdtemp(join(tmpdir(), 'syfo-artifact-doctor-'));
  try {
    const server = await file(project, '.fc/artifact/server.js');
    await truncate(server, DEFAULT_MAX_ARTIFACT_BYTES + 1);
    const result = spawnSync(
      process.execPath,
      [join(repositoryRoot, 'syfo-webdev-fullstack', 'scripts', 'doctor.mjs'), '--json'],
      { cwd: project, encoding: 'utf8' },
    );
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    const codes = report.findings.map((finding) => finding.code);
    assert.ok(codes.includes('builder-artifact-file-too-large'));
    assert.ok(codes.includes('builder-artifact-tree-too-large'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
