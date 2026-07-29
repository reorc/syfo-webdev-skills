import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

globalThis.crypto ??= webcrypto;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = path.join(root, 'assets/syfo-auth/src/_core/syfo-auth');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

async function loadProtocol() {
  const input = await readFile(path.join(core, 'protocol.ts'), 'utf8');
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
    fileName: 'protocol.ts',
  });
  assert.deepEqual(output.diagnostics ?? [], []);
  const url = `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`;
  return import(url);
}

async function bundleServerEntries() {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'syfo-auth-template-'));
  const files = [
    'types.ts',
    'protocol.ts',
    'paths.ts',
    'config.ts',
    'oidc.ts',
    'server.ts',
    'route-handlers.ts',
  ];
  for (const file of files) {
    const input = await readFile(path.join(core, file), 'utf8');
    const transpiled = ts.transpileModule(input, {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;
    const output = transpiled
      .replace("import 'server-only';\n", '')
      .replaceAll("from 'next/server'", "from './next-server.js'")
      .replace(/from '(\.\/[a-z-]+)'/g, "from '$1.js'");
    await writeFile(path.join(outputDirectory, file.replace(/\.tsx?$/, '.js')), output);
  }
  await writeFile(
    path.join(outputDirectory, 'next-server.js'),
    `
      export class NextRequest {}
      export class NextResponse extends Response {
        constructor(body, init) {
          super(body, init);
          const values = new Map();
          this.cookies = {
            values,
            set(name, value, options) { values.set(name, { value, options }); },
            delete(name) { values.set(name, { deleted: true }); },
          };
        }
        static json(value, init = {}) {
          return new NextResponse(JSON.stringify(value), {
            ...init,
            headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
          });
        }
        static redirect(url) {
          return new NextResponse(null, { status: 307, headers: { location: String(url) } });
        }
      }
    `,
  );
  await writeFile(
    path.join(outputDirectory, 'database.js'),
    `
      export async function upsertAppUser(input) {
        globalThis.__syfoAuthUpserts ??= [];
        globalThis.__syfoAuthUpserts.push(input);
        if (globalThis.__syfoAuthUpsertFailure) throw new Error('app_user_upsert_failed');
        return {
          id: 'local-user-1',
          issuer: input.issuer,
          subject: input.subject,
          serverId: input.serverId,
          email: input.email,
          emailVerified: input.emailVerified,
          name: input.name,
          picture: input.picture,
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
          lastLoginAt: '2026-07-23T00:00:00.000Z',
        };
      }
    `,
  );
  return {
    handlers: await import(
      `${pathToFileURL(path.join(outputDirectory, 'route-handlers.js'))}?v=${Date.now()}`
    ),
    server: await import(
      `${pathToFileURL(path.join(outputDirectory, 'server.js'))}?v=${Date.now()}`
    ),
    cleanup: () => rm(outputDirectory, { recursive: true, force: true }),
  };
}

async function createIdToken({ issuer, audience, nonce, appId, orgMember }) {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'route-test-key';
  publicJwk.alg = 'EdDSA';
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'EdDSA', kid: publicJwk.kid, typ: 'JWT' });
  const claims = {
    iss: issuer,
    aud: audience,
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3_600,
    nonce,
    email: 'user@example.com',
    email_verified: true,
    name: 'Example User',
    'https://syfo.cloud/hosted-app': {
      appId,
      serverId: 'server-1',
      orgMember,
    },
  };
  const body = encode(claims);
  const signature = Buffer.from(
    await crypto.subtle.sign(
      { name: 'Ed25519' },
      keyPair.privateKey,
      Buffer.from(`${header}.${body}`),
    ),
  ).toString('base64url');
  return { idToken: `${header}.${body}.${signature}`, publicJwk };
}

test('PKCE, state, returnTo, and encrypted session primitives fail closed', async () => {
  const protocol = await loadProtocol();
  const pair = await protocol.createPkcePair();
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{64}$/);
  assert.equal(pair.challenge, createHash('sha256').update(pair.verifier).digest('base64url'));
  const transaction = protocol.createOAuthTransaction({
    verifier: pair.verifier,
    redirectUri: 'https://app.example/api/_core/syfo-auth/callback',
    returnTo: '//evil.example',
    now: 1_000,
  });
  assert.equal(transaction.returnTo, '/');
  assert.equal(
    protocol.validateOAuthTransaction(transaction, transaction.state, 2_000),
    transaction,
  );
  assert.throws(
    () => protocol.validateOAuthTransaction(transaction, 'wrong', 2_000),
    /oauth_state_mismatch/,
  );
  assert.throws(
    () => protocol.validateOAuthTransaction(transaction, transaction.state, transaction.expiresAt),
    /oauth_transaction_expired/,
  );
  const secret = 'template-test-session-secret-at-least-32-characters';
  const sealed = await protocol.sealCookie({ sub: 'user-1' }, secret);
  assert.deepEqual(await protocol.openCookie(sealed, secret), { sub: 'user-1' });
  const tamperedIndex = 16;
  const tamperedCharacter = sealed[tamperedIndex] === 'A' ? 'B' : 'A';
  const tampered = `${sealed.slice(0, tamperedIndex)}${tamperedCharacter}${sealed.slice(
    tamperedIndex + 1,
  )}`;
  assert.equal(await protocol.openCookie(tampered, secret), null);
});

test('ID token validation binds signature, issuer, audience, expiry, and nonce', async () => {
  const protocol = await loadProtocol();
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'EdDSA';
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'EdDSA', kid: 'test-key', typ: 'JWT' });
  const signClaims = async (tokenClaims) => {
    const body = encode(tokenClaims);
    const signature = Buffer.from(
      await crypto.subtle.sign(
        { name: 'Ed25519' },
        keyPair.privateKey,
        Buffer.from(`${header}.${body}`),
      ),
    ).toString('base64url');
    return `${header}.${body}.${signature}`;
  };
  const claims = {
    iss: 'https://syfo.example/api/auth',
    aud: 'client-1',
    sub: 'user-1',
    exp: 2_000,
    nonce: 'nonce-1',
    email: 'user@example.com',
    'https://syfo.cloud/hosted-app': {
      appId: 'app-1',
      serverId: 'server-1',
      orgMember: true,
    },
  };
  const idToken = await signClaims(claims);
  const verified = await protocol.verifyIdToken({
    idToken,
    issuer: claims.iss,
    clientId: claims.aud,
    hostedAppId: 'app-1',
    nonce: claims.nonce,
    jwks: [publicJwk],
    now: 1_000_000,
  });
  assert.equal(verified.sub, claims.sub);
  const validInput = {
    idToken,
    issuer: claims.iss,
    clientId: claims.aud,
    hostedAppId: 'app-1',
    nonce: claims.nonce,
    jwks: [publicJwk],
    now: 1_000_000,
  };
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, issuer: 'https://evil.example/api/auth' }),
    /id_token_issuer_invalid/,
  );
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, clientId: 'other-client' }),
    /id_token_audience_invalid/,
  );
  const wrongAuthorizedParty = await signClaims({ ...claims, azp: 'other-client' });
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, idToken: wrongAuthorizedParty }),
    /id_token_authorized_party_invalid/,
  );
  const missingAuthorizedParty = await signClaims({ ...claims, aud: [claims.aud, 'other-client'] });
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, idToken: missingAuthorizedParty }),
    /id_token_authorized_party_invalid/,
  );
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, hostedAppId: 'other-app' }),
    /id_token_hosted_app_claim_invalid/,
  );
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, now: claims.exp * 1_000 }),
    /id_token_expired/,
  );
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split('.');
  const tamperedSignature = [
    encodedHeader,
    encodedPayload,
    `${encodedSignature.startsWith('A') ? 'B' : 'A'}${encodedSignature.slice(1)}`,
  ].join('.');
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, idToken: tamperedSignature }),
    /id_token_signature_invalid/,
  );
  await assert.rejects(
    protocol.verifyIdToken({ ...validInput, nonce: 'wrong' }),
    /id_token_nonce_invalid/,
  );
});

test('callback creates a private session consumed by session and protected routes', async () => {
  const protocol = await loadProtocol();
  const bundled = await bundleServerEntries();
  const previousFetch = globalThis.fetch;
  const previousEnvironment = {
    issuer: process.env.SYFO_OAUTH_ISSUER,
    clientId: process.env.SYFO_OAUTH_CLIENT_ID,
    clientSecret: process.env.SYFO_OAUTH_CLIENT_SECRET,
    hostedAppId: process.env.SYFO_HOSTED_APP_ID,
    sessionSecret: process.env.SYFO_AUTH_SESSION_SECRET,
  };
  const issuer = 'https://syfo.example/api/auth';
  const clientId = 'syfo_prod_client';
  const clientSecret = 'syfo_cs_private';
  const sessionSecret = 'route-test-session-secret-at-least-32-characters';
  const hostedAppId = 'app-1';
  process.env.SYFO_OAUTH_ISSUER = issuer;
  process.env.SYFO_OAUTH_CLIENT_ID = clientId;
  process.env.SYFO_OAUTH_CLIENT_SECRET = clientSecret;
  process.env.SYFO_HOSTED_APP_ID = hostedAppId;
  process.env.SYFO_AUTH_SESSION_SECRET = sessionSecret;
  globalThis.__syfoAuthUpserts = [];
  globalThis.__syfoAuthUpsertFailure = false;
  try {
    const pair = await protocol.createPkcePair();
    const transaction = protocol.createOAuthTransaction({
      verifier: pair.verifier,
      redirectUri: 'https://app.example/api/_core/syfo-auth/callback',
      returnTo: '/private',
    });
    const transactionCookie = await protocol.sealCookie(transaction, sessionSecret);
    const token = await createIdToken({
      issuer,
      audience: clientId,
      nonce: transaction.nonce,
      appId: hostedAppId,
      orgMember: true,
    });
    globalThis.fetch = async (url, init = {}) => {
      if (url === `${issuer}/.well-known/openid-configuration`) {
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/oauth2/authorize`,
          token_endpoint: `${issuer}/oauth2/token`,
          jwks_uri: `${issuer}/jwks`,
        });
      }
      if (url === `${issuer}/oauth2/token`) {
        assert.equal(
          init.headers.get('authorization'),
          `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        );
        assert.equal(init.body.get('code_verifier'), pair.verifier);
        return Response.json({
          access_token: 'app-access-token',
          token_type: 'Bearer',
          id_token: token.idToken,
        });
      }
      if (url === `${issuer}/jwks`) return Response.json({ keys: [token.publicJwk] });
      throw new Error(`unexpected fetch: ${url}`);
    };
    const callbackUrl = new URL(transaction.redirectUri);
    callbackUrl.searchParams.set('code', 'authorization-code');
    callbackUrl.searchParams.set('state', transaction.state);
    const request = {
      nextUrl: callbackUrl,
      cookies: { get: () => ({ value: transactionCookie }) },
      headers: new Headers({ origin: callbackUrl.origin }),
    };
    const callbackResponse = await bundled.handlers.callbackRoute(request);
    assert.equal(callbackResponse.status, 307);
    assert.equal(callbackResponse.headers.get('location'), 'https://app.example/private');
    const sessionCookie = callbackResponse.cookies.values.get('syfo_auth_session').value;
    const stored = await protocol.openCookie(sessionCookie, sessionSecret);
    assert.equal('accessToken' in stored, false);
    assert.equal('refreshToken' in stored, false);
    assert.equal('idToken' in stored, false);
    assert.equal(stored.appUser.id, 'local-user-1');
    assert.deepEqual(globalThis.__syfoAuthUpserts, [
      {
        issuer,
        subject: 'user-1',
        serverId: 'server-1',
        email: 'user@example.com',
        emailVerified: true,
        name: 'Example User',
        picture: undefined,
      },
    ]);
    assert.deepEqual(stored.hostedApp, {
      appId: hostedAppId,
      serverId: 'server-1',
      orgMember: true,
    });
    const authenticatedRequest = {
      ...request,
      cookies: {
        get: (name) => (name === 'syfo_auth_session' ? { value: sessionCookie } : undefined),
      },
    };
    const sessionResponse = await bundled.handlers.sessionRoute(authenticatedRequest);
    assert.equal(sessionResponse.status, 200);
    const browserSession = await sessionResponse.json();
    assert.equal(browserSession.user.sub, 'user-1');
    assert.equal(browserSession.appUser.id, 'local-user-1');
    assert.equal(browserSession.hostedApp.orgMember, true);
    assert.equal('accessToken' in browserSession, false);
    const protectedHandler = bundled.server.protectedRoute((_protectedRequest, context) =>
      Response.json({ sub: context.syfoAuth.user.sub, appUserId: context.syfoAuth.appUser.id }),
    );
    assert.deepEqual(await (await protectedHandler(authenticatedRequest, {})).json(), {
      sub: 'user-1',
      appUserId: 'local-user-1',
    });
    const orgHandler = bundled.server.orgProtectedRoute((_protectedRequest, context) =>
      Response.json({ appId: context.syfoAuth.hostedApp.appId }),
    );
    assert.deepEqual(await (await orgHandler(authenticatedRequest, {})).json(), {
      appId: hostedAppId,
    });
    const nonMemberCookie = await protocol.sealCookie(
      { ...stored, hostedApp: { ...stored.hostedApp, orgMember: false } },
      sessionSecret,
    );
    assert.equal(
      (
        await orgHandler(
          {
            ...authenticatedRequest,
            cookies: {
              get: (name) =>
                name === 'syfo_auth_session' ? { value: nonMemberCookie } : undefined,
            },
          },
          {},
        )
      ).status,
      403,
    );
    assert.equal(
      (await protectedHandler({ ...request, cookies: { get: () => undefined } }, {})).status,
      401,
    );
    assert.equal(
      (
        await bundled.handlers.logoutRoute({
          ...request,
          headers: new Headers({ origin: 'https://evil.example' }),
        })
      ).status,
      403,
    );
    globalThis.__syfoAuthUpsertFailure = true;
    const failedPersistence = await bundled.handlers.callbackRoute(request);
    assert.equal(failedPersistence.status, 401);
    assert.deepEqual(failedPersistence.cookies.values.get('syfo_auth_session'), {
      deleted: true,
    });
  } finally {
    globalThis.__syfoAuthUpserts = undefined;
    globalThis.__syfoAuthUpsertFailure = undefined;
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      SYFO_OAUTH_ISSUER: previousEnvironment.issuer,
      SYFO_OAUTH_CLIENT_ID: previousEnvironment.clientId,
      SYFO_OAUTH_CLIENT_SECRET: previousEnvironment.clientSecret,
      SYFO_HOSTED_APP_ID: previousEnvironment.hostedAppId,
      SYFO_AUTH_SESSION_SECRET: previousEnvironment.sessionSecret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await bundled.cleanup();
  }
});

test('route boundary exposes only sanitized browser/session contracts', async () => {
  const client = await source('assets/syfo-auth/src/_core/syfo-auth/client.tsx');
  const server = await source('assets/syfo-auth/src/_core/syfo-auth/server.ts');
  const handlers = await source('assets/syfo-auth/src/_core/syfo-auth/route-handlers.ts');
  const config = await source('assets/syfo-auth/src/_core/syfo-auth/config.ts');
  const sessionRoute = await source(
    'assets/syfo-auth/src/app/api/%5Fcore/syfo-auth/session/route.ts',
  );
  assert.match(client, /export function useSyfoAuth/);
  assert.match(client, /export function startLogin/);
  assert.doesNotMatch(client, /SYFO_OAUTH_CLIENT_SECRET|accessToken|refreshToken|idToken/);
  assert.match(server, /export function protectedRoute/);
  assert.match(server, /export function orgProtectedRoute/);
  assert.match(server, /status: 401/);
  assert.match(server, /status: 403/);
  assert.match(server, /appUser: stored\.appUser/);
  assert.doesNotMatch(server, /accessToken|refreshToken|idToken/);
  assert.match(handlers, /code_challenge_method: 'S256'/);
  assert.match(handlers, /validateOAuthTransaction/);
  assert.match(handlers, /verifyIdToken/);
  assert.match(handlers, /await upsertAppUser/);
  assert.match(handlers, /const session = sessionFromClaims/);
  assert.ok(
    handlers.indexOf('await upsertAppUser') < handlers.indexOf('const session = sessionFromClaims'),
  );
  assert.match(handlers, /request\.headers\.get\('origin'\)/);
  assert.match(config, /process\.env\.SYFO_OAUTH_CLIENT_SECRET/);
  assert.match(config, /import 'server-only'/);
  assert.match(sessionRoute, /sessionRoute/);
});

test('route assets encode the literal underscore segment for Next.js routing', async () => {
  const routeRoot = path.join(root, 'assets/syfo-auth/src/app/api');
  for (const route of ['login', 'callback', 'session', 'logout']) {
    const input = await readFile(
      path.join(routeRoot, '%5Fcore', 'syfo-auth', route, 'route.ts'),
      'utf8',
    );
    assert.match(input, new RegExp(`export const (GET|POST) = ${route}Route`));
    await assert.rejects(access(path.join(routeRoot, '_core', 'syfo-auth', route, 'route.ts')), {
      code: 'ENOENT',
    });
  }
});

test('all template TypeScript files are syntactically valid', async () => {
  const files = [
    'types.ts',
    'protocol.ts',
    'paths.ts',
    'config.ts',
    'oidc.ts',
    'server.ts',
    'client.tsx',
    'route-handlers.ts',
    'database.ts',
    'example-user-data.ts',
  ];
  for (const file of files) {
    const input = await readFile(path.join(core, file), 'utf8');
    const output = ts.transpileModule(input, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
      fileName: file,
    });
    assert.deepEqual(output.diagnostics ?? [], [], file);
  }
});

test('App-local user migration and repository keep identity stable and writes transactional', async () => {
  const migration = await source('assets/syfo-auth/migrations/0001_syfo_auth_users.sql');
  const database = await source('assets/syfo-auth/src/_core/syfo-auth/database.ts');
  const example = await source('assets/syfo-auth/src/_core/syfo-auth/example-user-data.ts');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS app_users/);
  assert.match(migration, /UNIQUE KEY app_users_issuer_subject_unique \(issuer, subject\)/);
  assert.doesNotMatch(migration, /UNIQUE KEY[^\n]*email/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS app_user_preferences/);
  assert.match(database, /await connection\.beginTransaction\(\)/);
  assert.match(database, /ON DUPLICATE KEY UPDATE/);
  assert.match(database, /WHERE issuer = \? AND subject = \?/);
  assert.match(database, /await connection\.commit\(\)/);
  assert.match(database, /await connection\.rollback\(\)/);
  assert.match(database, /ssl: \{ minVersion: 'TLSv1\.2' as const \}/);
  assert.match(example, /WHERE app_user_id = \?/);
  assert.doesNotMatch(database, /accessToken|refreshToken|idToken/);
});
