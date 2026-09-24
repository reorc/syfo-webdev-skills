import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const reference = await readFile(
  new URL('./syfo-webdev/references/access-identity-authorization.md', import.meta.url),
  'utf8',
);
const authReadme = await readFile(
  new URL('./syfo-webdev/assets/syfo-auth/README.md', import.meta.url),
  'utf8',
);
const authServer = await readFile(
  new URL('./syfo-webdev/assets/syfo-auth/src/_core/syfo-auth/server.ts', import.meta.url),
  'utf8',
);
const legacyAuthReadme = await readFile(
  new URL('./syfo-webdev-fullstack/assets/syfo-auth/README.md', import.meta.url),
  'utf8',
);
const legacyAuthServer = await readFile(
  new URL('./syfo-webdev-fullstack/assets/syfo-auth/src/_core/syfo-auth/server.ts', import.meta.url),
  'utf8',
);
const evals = JSON.parse(
  await readFile(new URL('./syfo-webdev/evals/evals.json', import.meta.url), 'utf8'),
);

test('unified Skill requires a three-layer security plan before implementation', () => {
  assert.match(skill, /Access, identity, and authorization/);
  assert.match(skill, /references\/access-identity-authorization\.md/);
  assert.match(skill, /internal tool, external product, or public information website/);
  assert.match(skill, /`public`, `authenticated`, `org`, or\s+`org_members`/s);
  assert.match(skill, /Add Syfo OAuth only when the App\s+must know which user is acting/s);
  assert.match(skill, /Enforce it in server\s+routes and mutations/s);
  assert.match(skill, /Do not\s+invent a machine API or API-key system/s);
});

test('access reference defines exact platform semantics and product-mode defaults', () => {
  assert.match(reference, /`public` \| Anyone may open the website without signing in/);
  assert.match(reference, /`authenticated` \| Any signed-in Syfo user, including users outside/);
  assert.match(reference, /`org` \| Any active member of the owning organization/);
  assert.match(reference, /`org_members` \| Only selected active members of the owning organization/);
  assert.match(reference, /Internal tool: default to `org`; use `org_members` only for a named subset/);
  assert.match(reference, /External product: use `public` when anonymous acquisition or public pages exist/);
  assert.match(reference, /Access changes are a separate human-owned action in the management UI/);
});

test('OAuth and App authorization remain distinct from platform access', () => {
  assert.match(reference, /`public` may still use Syfo OAuth on account-only routes/);
  assert.match(reference, /platform sign-in to enter, but App code still\s+needs its own OAuth flow/s);
  assert.match(reference, /`protectedRoute` proves that an App session exists; it does not grant business permissions/);
  assert.match(reference, /`orgProtectedRoute` additionally checks the signed login-time `orgMember` claim/);
  assert.match(reference, /Default deny when the App cannot prove/);
  assert.match(authReadme, /Platform access controls who may open the whole website/);
  assert.match(authReadme, /Protect every relevant API route and mutation; hiding UI is not authorization/);
  assert.match(legacyAuthReadme, /Platform access controls who may open the whole website/);
  for (const source of [authServer, legacyAuthServer]) {
    assert.match(source, /Business authorization such as roles, ownership, and entitlements remains/);
    assert.match(source, /It does not replace App roles, ownership, or entitlement checks/);
  }
});

test('task evals cover internal, external, Syfo-wide, and public information modes', () => {
  for (const id of [12, 13, 14, 15]) {
    assert.ok(evals.evals.some((entry) => entry.id === id), `missing access eval ${id}`);
  }
  const internal = evals.evals.find((entry) => entry.id === 12);
  const external = evals.evals.find((entry) => entry.id === 13);
  const syfoWide = evals.evals.find((entry) => entry.id === 14);
  const publicInfo = evals.evals.find((entry) => entry.id === 15);
  assert.match(internal.expected_output, /org.*Syfo OAuth.*App role ACL/i);
  assert.match(external.expected_output, /public.*Syfo OAuth.*server-side ownership/i);
  assert.match(syfoWide.expected_output, /authenticated.*App authorization/i);
  assert.match(publicInfo.expected_output, /public.*no Syfo OAuth.*no user ACL/i);
});
