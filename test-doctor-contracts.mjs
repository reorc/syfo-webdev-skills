import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

const repositoryRoot = process.cwd();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function createPng(size, { colorType = 6, imageData, chunks } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = colorType;
  const channels = colorType === 2 ? 3 : 4;
  const rowLength = size * channels + 1;
  const pixels = Buffer.alloc(rowLength * size);
  const pngChunks = chunks ?? [pngChunk('IDAT', imageData ?? deflateSync(pixels))];
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    ...pngChunks,
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

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

async function createAppIcons(project) {
  await mkdir(join(project, 'public'), { recursive: true });
  await mkdir(join(project, 'app'), { recursive: true });
  for (const [file, size] of [
    ['syfo-app-icon.svg', 512],
    ['favicon-16.svg', 16],
    ['favicon-32.svg', 32],
    ['app-icon-180.svg', 180],
  ]) {
    await writeFile(
      join(project, 'public', file),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><path fill="#123456" d="M64 64h384v384H64z"/></svg>\n`,
    );
  }
  for (const [file, size] of [
    ['icon1.png', 16],
    ['icon2.png', 32],
    ['icon3.png', 180],
    ['icon4.png', 512],
  ]) await writeFile(join(project, 'app', file), createPng(size));
}

async function createStaticFixture() {
  const project = await mkdtemp(join(tmpdir(), 'syfo-static-doctor-'));
  await mkdir(join(project, 'scripts'), { recursive: true });
  await writeFile(join(project, 'package-lock.json'), '{}\n');
  await writeFile(
    join(project, 'package.json'),
    `${JSON.stringify({
      private: true,
      packageManager: 'npm@10.9.2',
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
  await createAppIcons(project);
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
      packageManager: 'npm@10.9.2',
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
  await createAppIcons(project);
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

test('npm apps pin the builder-compatible npm 10 version', async () => {
  for (const skill of ['syfo-webdev-static', 'syfo-webdev-fullstack']) {
    const project = skill === 'syfo-webdev-static'
      ? await createStaticFixture()
      : await createFullstackFixture();
    try {
      const packagePath = join(project, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
      delete packageJson.packageManager;
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      assert.ok(errorCodes(runDoctor(skill, project)).includes('npm-builder-version-required'));

      packageJson.packageManager = 'npm@11.4.2';
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      assert.ok(errorCodes(runDoctor(skill, project)).includes('npm-builder-version-mismatch'));

      packageJson.packageManager = 'npm@10.9.2';
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
      assert.equal(errorCodes(runDoctor(skill, project)).includes('npm-builder-version-mismatch'), false);
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  }
});

test('static doctor requires the Next.js 16 Node engine contract', async () => {
  const project = await createStaticFixture();
  try {
    const packagePath = join(project, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.dependencies.next = '16.3.0';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    assert.ok(errorCodes(runDoctor('syfo-webdev-static', project)).includes('next16-node-engine'));

    packageJson.engines = { node: '>=20.9.0' };
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    assert.ok(!errorCodes(runDoctor('syfo-webdev-static', project)).includes('next16-node-engine'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('fullstack doctor requires the Next.js 16 Node engine contract', async () => {
  const project = await createFullstackFixture();
  try {
    const packagePath = join(project, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
    packageJson.dependencies.next = '16.3.0';
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    assert.ok(errorCodes(runDoctor('syfo-webdev-fullstack', project)).includes('next16-node-engine'));

    packageJson.engines = { node: '>=20.9.0' };
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    assert.ok(!errorCodes(runDoctor('syfo-webdev-fullstack', project)).includes('next16-node-engine'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('doctor blocks malformed, externally-referencing, and non-regular App icons', async () => {
  const project = await createStaticFixture();
  const outsideIcon = join(tmpdir(), `syfo-outside-icon-${Date.now()}.svg`);
  try {
    await writeFile(
      join(project, 'public', 'favicon-16.svg'),
      '<svg width="16" height="16" viewBox="0 0 512 512"><style>@import "https://attacker.example/icon.css"</style></svg>\n',
    );
    await writeFile(
      join(project, 'public', 'favicon-32.svg'),
      '<svg width="32" height="32" viewBox="0 0 512 512"><image href="/tracking.svg"/></svg>\n',
    );
    await writeFile(
      join(project, 'public', 'app-icon-180.svg'),
      '<html><svg width="180" height="180" viewBox="0 0 512 512"/></html>\n',
    );
    await writeFile(outsideIcon, '<svg width="512" height="512" viewBox="0 0 512 512"/>\n');
    await rm(join(project, 'public', 'syfo-app-icon.svg'));
    await symlink(outsideIcon, join(project, 'public', 'syfo-app-icon.svg'));
    const codes = errorCodes(runDoctor('syfo-webdev-static', project));
    assert.equal(codes.filter((code) => code === 'app-icon-unsafe-svg').length, 3);
    assert.ok(codes.includes('app-icon-not-regular'));
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(outsideIcon, { force: true });
  }
});

test('doctor rejects encoded CSS, namespaces, entities, and SMIL mutation', async () => {
  const cases = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><style>@im&#x70;ort "https://attacker.example/x.css"</style></svg>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><style>@\\69mport "https://attacker.example/x.css"</style></svg>\n',
    '<html:svg xmlns:html="http://www.w3.org/1999/xhtml" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"/>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><text>&bogus;</text></svg>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><image href="#safe"><set attributeName="href" to="https://attacker.example/tracker.svg"/></image></svg>\n',
    '<?xml-stylesheet href="https://attacker.example/x.css" type="text/css"?><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"/>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><animateColor attributeName="fill" values="red;blue"/></svg>\n',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512"><discard begin="1s"/></svg>\n',
  ];
  for (const source of cases) {
    const project = await createStaticFixture();
    try {
      await writeFile(join(project, 'public', 'favicon-16.svg'), source);
      assert.ok(errorCodes(runDoctor('syfo-webdev-static', project)).includes('app-icon-unsafe-svg'));
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  }
});

test('doctor requires real per-size PNG browser metadata', async () => {
  const project = await createFullstackFixture();
  try {
    await writeFile(join(project, 'app', 'icon2.png'), createPng(16));
    assert.ok(errorCodes(runDoctor('syfo-webdev-fullstack', project)).includes('app-icon-metadata-invalid'));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test('doctor rejects unsupported, empty, and undecodable PNG pixel data', async () => {
  const pixels = deflateSync(Buffer.alloc(16 * (1 + 16 * 4)));
  const cases = [
    createPng(16, { colorType: 1 }),
    createPng(16, { imageData: Buffer.alloc(0) }),
    createPng(16, { imageData: Buffer.from('not-zlib') }),
    createPng(16, { chunks: [pngChunk('PLTE', Buffer.alloc(1)), pngChunk('IDAT', pixels)] }),
    createPng(16, {
      chunks: [pngChunk('IDAT', Buffer.alloc(0)), pngChunk('PLTE', Buffer.from([0, 0, 0])), pngChunk('IDAT', pixels)],
    }),
  ];
  for (const skill of ['syfo-webdev-static', 'syfo-webdev-fullstack']) {
    for (const png of cases) {
      const project = skill === 'syfo-webdev-static' ? await createStaticFixture() : await createFullstackFixture();
      try {
        await writeFile(join(project, 'app', 'icon1.png'), png);
        assert.ok(errorCodes(runDoctor(skill, project)).includes('app-icon-metadata-invalid'));
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    }
  }
});

test('skill lifecycle keeps icon validation and deploy state machine explicit', async () => {
  for (const skill of ['syfo-webdev-static', 'syfo-webdev-fullstack']) {
    const source = await readFile(join(repositoryRoot, skill, 'SKILL.md'), 'utf8');
    const lifecycle = await readFile(
      join(repositoryRoot, skill, 'references', 'deployment-lifecycle.md'),
      'utf8',
    );
    assert.match(source, /After icon creation, run the doctor again[\s\S]*before `syfo app validate`/);
    assert.match(
      lifecycle,
      /source_ready[\s\S]*syfo app deploy --target "<reply-target>" --json[\s\S]*awaiting_confirmation/,
    );
    assert.doesNotMatch(lifecycle, /syfo app deploy --json/);
    assert.match(lifecycle, /operationId[\s\S]*do not create a second deploy operation/);
    assert.match(lifecycle, /owner=null[\s\S]*Do not run `syfo app claim` as a routine prerequisite/);
  }
});

test('skill architecture choice rejects speculative fullstack upgrades', async () => {
  const staticSkill = await readFile(join(repositoryRoot, 'syfo-webdev-static', 'SKILL.md'), 'utf8');
  const fullstackSkill = await readFile(join(repositoryRoot, 'syfo-webdev-fullstack', 'SKILL.md'), 'utf8');

  assert.match(staticSkill, /Use static by default/);
  assert.match(staticSkill, /may need a backend later/i);
  assert.match(staticSkill, /ask the user rather than[\s\S]*guessing/);
  assert.match(fullstackSkill, /Do not choose fullstack only for possible future expansion/);
  assert.match(fullstackSkill, /ask the user rather than guessing/);
});

test('skill keeps npm 10 gate and immutable deploy preparation explicit', async () => {
  for (const skill of ['syfo-webdev-static', 'syfo-webdev-fullstack']) {
    const source = await readFile(join(repositoryRoot, skill, 'SKILL.md'), 'utf8');
    const lifecycle = await readFile(
      join(repositoryRoot, skill, 'references', 'deployment-lifecycle.md'),
      'utf8',
    );
    assert.match(
      source,
      /packageManager: npm@10\.x\.y[\s\S]*npx --yes npm@<package\.json packageManager version> ci --ignore-scripts --dry-run/,
    );
    assert.match(lifecycle, /validated[\s\S]*Commit and push immutable source[\s\S]*source_ready/);
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
