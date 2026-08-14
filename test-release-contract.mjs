import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('release packages three skills and declares daemon-owned marker contract', async () => {
  const output = await mkdtemp(join(tmpdir(), 'syfo-skills-release-'));
  try {
    const run = spawnSync('bash', ['scripts/package-release.sh', output], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.skills, ['syfo-webdev', 'syfo-webdev-static', 'syfo-webdev-fullstack']);
    assert.deepEqual(manifest.managedMarker, { name: '.syfo-managed.json', managedBy: 'syfo-daemon', schemaVersion: 1 });
    const listing = spawnSync('tar', ['-tzf', join(output, manifest.archive)], { encoding: 'utf8' });
    assert.equal(listing.status, 0, listing.stderr);
    for (const skill of manifest.skills) assert.match(listing.stdout, new RegExp(`^${skill}/SKILL\\.md$`, 'm'));
    assert.doesNotMatch(listing.stdout, /\.syfo-managed\.json/);
    const checksums = await readFile(join(output, 'checksums.txt'), 'utf8');
    assert.match(checksums, /syfo-webdev-skills\.tar\.gz/);
    assert.match(checksums, /manifest\.json/);
  } finally { await rm(output, { recursive: true, force: true }); }
});
