import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const source = await readFile(
  new URL('syfo-webdev-static/templates/project-static-server.mjs', import.meta.url),
  'utf8',
);

test('static runtime delegates visitor access without embedding a password', () => {
  assert.match(source, /BUILT_IN_FORGE_API_URL/u);
  assert.match(source, /BUILT_IN_FORGE_API_KEY/u);
  assert.match(source, /\/api\/v1\/hosted-app-auth\/basic\/verify/u);
  assert.match(source, /x-syfo-hosted-app-token/u);
  assert.match(source, /x-syfo-basic-authorization/u);
  assert.doesNotMatch(source, /BASIC_AUTH_PASSWORD|passwordHash|passwordSalt/u);
});

test('health checks bypass auth and verifier failures fail closed', () => {
  const healthIndex = source.indexOf('url.pathname === "/healthz"');
  const authIndex = source.indexOf('await authorizeRequest(request)');
  assert.ok(healthIndex >= 0 && authIndex > healthIndex);
  assert.match(source, /status: 503/u);
  assert.match(
    source,
    /result\.status === 401 && \/\^Basic\(\?:\\s\|\$\)\/i\.test/,
    'only a challenged visitor 401 is exposed as a password prompt',
  );
  assert.match(source, /status: visitorChallenge \? 401 : 503/u);
  assert.match(source, /WWW-Authenticate/u);
  assert.doesNotMatch(
    source,
    /console\.log\(.*authorization|process\.stdout\.write\(.*authorization/isu,
  );
});

test('static runtime blocks symlink escapes after delegated access succeeds', async () => {
  const artifact = await mkdtemp(join(tmpdir(), 'syfo-static-auth-runtime-'));
  const publicRoot = join(artifact, 'public');
  await mkdir(publicRoot, { recursive: true });
  await writeFile(join(artifact, 'server.mjs'), source);
  await writeFile(join(publicRoot, 'index.html'), '<h1>ok</h1>');
  await writeFile(join(publicRoot, '404.html'), '<h1>missing</h1>');
  await writeFile(join(artifact, 'secret.txt'), 'outside public root');
  await symlink('../secret.txt', join(publicRoot, 'leak.txt'));

  let verifierRequests = 0;
  const verifier = createServer((request, response) => {
    verifierRequests += 1;
    assert.equal(request.headers['x-syfo-hosted-app-token'], 'runtime-token');
    if (request.headers['x-syfo-basic-authorization'] === 'Basic dGVzdDp0ZXN0') {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Syfo Hosted App"' }).end();
  });
  await new Promise((resolve, reject) => {
    verifier.once('error', reject);
    verifier.listen(0, '127.0.0.1', resolve);
  });
  const verifierAddress = verifier.address();
  assert.ok(verifierAddress && typeof verifierAddress !== 'string');

  const appPort = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      assert.ok(address && typeof address !== 'string');
      probe.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: artifact,
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      PORT: String(appPort),
      BUILT_IN_FORGE_API_URL: `http://127.0.0.1:${verifierAddress.port}`,
      BUILT_IN_FORGE_API_KEY: 'runtime-token',
    },
    stdio: 'ignore',
  });

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const health = await fetch(`http://127.0.0.1:${appPort}/healthz`);
        if (health.ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(verifierRequests, 0, 'health must bypass delegated auth');

    const anonymous = await fetch(`http://127.0.0.1:${appPort}/`);
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get('www-authenticate') || '', /^Basic/u);

    const authorized = await fetch(`http://127.0.0.1:${appPort}/`, {
      headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
    });
    assert.equal(authorized.status, 200);

    for (const path of ['/missing', '/leak.txt']) {
      for (const method of ['GET', 'HEAD']) {
        const missing = await fetch(`http://127.0.0.1:${appPort}${path}`, {
          method,
          headers: {
            Authorization: 'Basic dGVzdDp0ZXN0',
            Range: 'bytes=0-3',
          },
        });
        assert.equal(missing.status, 404);
        assert.equal(missing.headers.get('content-range'), null);
      }
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await new Promise((resolve) => verifier.close(resolve));
    await rm(artifact, { recursive: true, force: true });
  }
});

test('static smoke harness injects a local public verifier', async () => {
  const artifact = await mkdtemp(join(tmpdir(), 'syfo-static-smoke-runtime-'));
  const publicRoot = join(artifact, 'public');
  await mkdir(publicRoot, { recursive: true });
  await writeFile(join(artifact, 'server.mjs'), source);
  await writeFile(join(publicRoot, 'index.html'), '<h1>ok</h1>');
  await writeFile(join(publicRoot, '404.html'), '<h1>missing</h1>');

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        new URL('syfo-webdev-static/scripts/smoke-static.mjs', import.meta.url).pathname,
        '--artifact',
        artifact,
        '--path',
        '/',
      ],
      { timeout: 20_000 },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.accessMode, 'local-public-verifier');
    assert.deepEqual(
      report.results.map((result) => [result.path, result.status]),
      [
        ['/healthz', 200],
        ['/', 200],
        ['missing-route', 404],
      ],
    );
  } finally {
    await rm(artifact, { recursive: true, force: true });
  }
});
