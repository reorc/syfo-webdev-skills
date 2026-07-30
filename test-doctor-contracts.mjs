import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repositoryRoot = process.cwd();

function runDoctor(skill, project) {
  const result = spawnSync(
    process.execPath,
    [join(repositoryRoot, skill, 'scripts', 'doctor.mjs'), '--json'],
    { cwd: project, encoding: 'utf8' },
  );
  return {
    status: result.status,
    result: JSON.parse(result.stdout),
    stderr: result.stderr,
  };
}

function errorCodes(run) {
  return run.result.findings
    .filter((finding) => finding.level === 'error')
    .map((finding) => finding.code);
}

async function createStaticFixture() {
  const project = await mkdtemp(join(tmpdir(), 'syfo-static-doctor-'));
  await mkdir(join(project, 'scripts'), { recursive: true });
  await writeFile(join(project, 'package-lock.json'), '{}\n');
  await writeFile(
    join(project, 'package.json'),
    `${JSON.stringify({
      private: true,
      scripts: {
        build: 'next build && node scripts/assemble-static.mjs',
        typecheck: 'tsc --noEmit',
      },
      dependencies: { next: '15.5.21' },
    }, null, 2)}\n`,
  );
  await writeFile(join(project, 'next.config.mjs'), 'export default { output: "export" };\n');
  await cp(
    join(repositoryRoot, 'syfo-webdev-static', 'templates', 'project-static-server.mjs'),
    join(project, 'scripts', 'static-server.mjs'),
  );
  await writeFile(join(project, 'scripts', 'assemble-static.mjs'), 'export {};\n');
  await cp(
    join(repositoryRoot, 'syfo-webdev-static', 'templates', 'syfo.nextjs-static.yaml'),
    join(project, 'syfo.yaml'),
  );
  return project;
}

async function createFullstackFixture() {
  const project = await mkdtemp(join(tmpdir(), 'syfo-fullstack-doctor-'));
  await mkdir(join(project, 'app', 'healthz'), { recursive: true });
  await mkdir(join(project, 'src'), { recursive: true });
  await writeFile(join(project, 'package-lock.json'), '{}\n');
  await writeFile(
    join(project, 'package.json'),
    `${JSON.stringify({
      private: true,
      scripts: {
        build: 'next build && node scripts/assemble-next-standalone.mjs',
        typecheck: 'tsc --noEmit',
        test: 'node --test',
        'db:migrate': 'node db/migrate.mjs',
      },
      dependencies: { next: '15.5.21', mysql2: '3.23.1' },
    }, null, 2)}\n`,
  );
  await writeFile(join(project, 'next.config.mjs'), 'export default { output: "standalone" };\n');
  await writeFile(join(project, 'app', 'healthz', 'route.ts'), 'export function GET() { return Response.json({ status: "ok" }); }\n');
  await writeFile(
    join(project, 'src', 'database.ts'),
    'export const env = ["TIDB_HOST", "TIDB_PORT", "TIDB_USER", "TIDB_PASSWORD", "TIDB_DATABASE"];\n',
  );
  await cp(
    join(repositoryRoot, 'syfo-webdev-fullstack', 'templates', 'syfo.nextjs-fullstack.yaml'),
    join(project, 'syfo.yaml'),
  );
  return project;
}

test('official npm fixtures satisfy doctor contract checks', async () => {
  const projects = await Promise.all([createStaticFixture(), createFullstackFixture()]);
  try {
    const staticRun = runDoctor('syfo-webdev-static', projects[0]);
    const fullstackRun = runDoctor('syfo-webdev-fullstack', projects[1]);
    assert.deepEqual(errorCodes(staticRun), [], staticRun.stderr);
    assert.deepEqual(errorCodes(fullstackRun), [], fullstackRun.stderr);
  } finally {
    await Promise.all(projects.map((project) => rm(project, { recursive: true, force: true })));
  }
});

test('multiple lockfiles are hard errors', async () => {
  const projects = await Promise.all([createStaticFixture(), createFullstackFixture()]);
  try {
    for (const [skill, project] of [
      ['syfo-webdev-static', projects[0]],
      ['syfo-webdev-fullstack', projects[1]],
    ]) {
      await writeFile(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
      assert.ok(errorCodes(runDoctor(skill, project)).includes('multiple-lockfiles'));
    }
  } finally {
    await Promise.all(projects.map((project) => rm(project, { recursive: true, force: true })));
  }
});

test('static doctor rejects mixed and compound build commands', async () => {
  const project = await createStaticFixture();
  try {
    const manifestPath = join(project, 'syfo.yaml');
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(
      manifestPath,
      manifest.replace('install: npm ci', 'install: pnpm install --frozen-lockfile')
        .replace('command: npm run build', 'command: npm run export && node scripts/assemble-static.mjs'),
    );
    const codes = errorCodes(runDoctor('syfo-webdev-static', project));
    assert.ok(codes.includes('manifest-install-lock-mismatch'));
    assert.ok(codes.includes('manifest-build-lock-mismatch'));
    assert.ok(codes.includes('manifest-compound-build'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('fullstack doctor rejects output, run, and migration drift', async () => {
  const project = await createFullstackFixture();
  try {
    const manifestPath = join(project, 'syfo.yaml');
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(
      manifestPath,
      manifest.replace('output: .fc/artifact', 'output: .next/standalone')
        .replace('command: node server.js', 'command: node .next/standalone/server.js')
        .replace('command: npm run db:migrate', 'command: pnpm run db:migrate'),
    );
    const codes = errorCodes(runDoctor('syfo-webdev-fullstack', project));
    assert.ok(codes.includes('manifest-output-contract'));
    assert.ok(codes.includes('manifest-run-contract'));
    assert.ok(codes.includes('manifest-migration-lock-mismatch'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('doctor mirrors build-service pnpm support and rejects bun locks', async () => {
  const project = await createFullstackFixture();
  try {
    await rm(join(project, 'package-lock.json'));
    await writeFile(join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    const manifestPath = join(project, 'syfo.yaml');
    const manifest = await readFile(manifestPath, 'utf8');
    await writeFile(
      manifestPath,
      manifest.replace('install: npm ci', 'install: pnpm install --frozen-lockfile')
        .replace('command: npm run build', 'command: pnpm build')
        .replace('command: npm run db:migrate', 'command: pnpm db:migrate'),
    );
    assert.deepEqual(errorCodes(runDoctor('syfo-webdev-fullstack', project)), []);

    await rm(join(project, 'pnpm-lock.yaml'));
    await writeFile(join(project, 'bun.lock'), '');
    assert.ok(errorCodes(runDoctor('syfo-webdev-fullstack', project)).includes('unsupported-lockfile'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});
