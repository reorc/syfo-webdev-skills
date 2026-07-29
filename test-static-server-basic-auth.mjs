import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
