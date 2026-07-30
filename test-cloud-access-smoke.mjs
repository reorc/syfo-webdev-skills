import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const staticScript = join(root, 'syfo-webdev-static', 'scripts', 'smoke-cloud-access.mjs');
const fullstackScript = join(root, 'syfo-webdev-fullstack', 'scripts', 'smoke-cloud-access.mjs');

function run(script, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

test('static and fullstack ship the same access-aware cloud smoke', async () => {
  assert.equal(await readFile(staticScript, 'utf8'), await readFile(fullstackScript, 'utf8'));
});

test('cloud smoke validates public and Basic Auth policies without reporting credentials', async () => {
  let mode = 'public';
  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200).end('ok');
      return;
    }
    if (mode === 'public') {
      response.writeHead(200).end('public');
      return;
    }
    if (request.headers.authorization === 'Basic dGVzdDpzZWNyZXQ=') {
      response.writeHead(200).end('authorized');
      return;
    }
    response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="test"' }).end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const publicRun = await run(staticScript, ['--url', url, '--mode', 'public']);
    assert.equal(publicRun.code, 0, publicRun.stderr);
    assert.equal(JSON.parse(publicRun.stdout).passed, true);

    mode = 'basic_auth';
    const basicRun = await run(
      fullstackScript,
      ['--url', url, '--mode', 'basic_auth'],
      { SYFO_BASIC_AUTH_USERNAME: 'test', SYFO_BASIC_AUTH_PASSWORD: 'secret' },
    );
    assert.equal(basicRun.code, 0, basicRun.stderr);
    assert.equal(JSON.parse(basicRun.stdout).passed, true);
    assert.doesNotMatch(basicRun.stdout, /test|secret|Authorization/u);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
