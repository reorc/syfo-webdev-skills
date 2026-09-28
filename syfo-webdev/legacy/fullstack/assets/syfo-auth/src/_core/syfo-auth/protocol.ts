import type {
  AppUser,
  OAuthJwk,
  OAuthTransaction,
  StoredSyfoAuthSession,
  SyfoAuthUser,
  SyfoHostedAppClaim,
} from './types';

const syfoHostedAppClaimName = 'https://syfo.cloud/hosted-app' as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomValue(size: number): string {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function sessionKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32)
    throw new Error('SYFO_AUTH_SESSION_SECRET must contain at least 32 characters');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomValue(48);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(verifier));
  return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)) };
}

export function createOAuthTransaction(input: {
  verifier: string;
  redirectUri: string;
  returnTo: string;
  now?: number;
}): OAuthTransaction {
  const now = input.now ?? Date.now();
  return {
    state: randomValue(32),
    nonce: randomValue(32),
    verifier: input.verifier,
    redirectUri: input.redirectUri,
    returnTo: safeReturnTo(input.returnTo),
    expiresAt: now + 10 * 60 * 1000,
  };
}

export function validateOAuthTransaction(
  transaction: OAuthTransaction | null,
  returnedState: string | null,
  now = Date.now(),
): OAuthTransaction {
  if (!transaction || !returnedState) throw new Error('oauth_transaction_missing');
  if (transaction.expiresAt <= now) throw new Error('oauth_transaction_expired');
  if (!timingSafeEqual(transaction.state, returnedState)) throw new Error('oauth_state_mismatch');
  return transaction;
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return '/';
  return value;
}

export async function sealCookie(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await sessionKey(secret),
      encoder.encode(JSON.stringify(value)),
    ),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv);
  combined.set(ciphertext, iv.length);
  return encodeBase64Url(combined);
}

export async function openCookie<T>(value: string | undefined, secret: string): Promise<T | null> {
  if (!value) return null;
  try {
    const combined = decodeBase64Url(value);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      await sessionKey(secret),
      combined.slice(12),
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    return null;
  }
}

type IdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  sub?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [syfoHostedAppClaimName]?: SyfoHostedAppClaim;
};

export async function verifyIdToken(input: {
  idToken: string;
  issuer: string;
  clientId: string;
  hostedAppId: string;
  nonce: string;
  jwks: OAuthJwk[];
  now?: number;
}): Promise<IdTokenClaims & { sub: string; exp: number }> {
  const parts = input.idToken.split('.');
  if (parts.length !== 3) throw new Error('id_token_malformed');
  const header = JSON.parse(decoder.decode(decodeBase64Url(parts[0]))) as OAuthJwk;
  const claims = JSON.parse(decoder.decode(decodeBase64Url(parts[1]))) as IdTokenClaims;
  if (!header.kid || !header.alg) throw new Error('id_token_header_invalid');
  const jwk = input.jwks.find(
    (candidate) => candidate.kid === header.kid && (!candidate.alg || candidate.alg === header.alg),
  );
  if (!jwk) throw new Error('id_token_key_missing');
  const algorithm = signatureAlgorithm(jwk, header.alg);
  const key = await crypto.subtle.importKey('jwk', jwk, algorithm.importAlgorithm, false, [
    'verify',
  ]);
  const verified = await crypto.subtle.verify(
    algorithm.verifyAlgorithm,
    key,
    decodeBase64Url(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error('id_token_signature_invalid');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (claims.iss !== input.issuer) throw new Error('id_token_issuer_invalid');
  if (!audiences.includes(input.clientId)) throw new Error('id_token_audience_invalid');
  if (claims.azp !== undefined && claims.azp !== input.clientId)
    throw new Error('id_token_authorized_party_invalid');
  if (audiences.length > 1 && !claims.azp) throw new Error('id_token_authorized_party_invalid');
  if (!claims.sub) throw new Error('id_token_subject_missing');
  if (!claims.exp || claims.exp <= nowSeconds) throw new Error('id_token_expired');
  if (!claims.nonce || !timingSafeEqual(claims.nonce, input.nonce))
    throw new Error('id_token_nonce_invalid');
  const hostedApp = claims[syfoHostedAppClaimName];
  if (
    !hostedApp ||
    hostedApp.appId !== input.hostedAppId ||
    typeof hostedApp.serverId !== 'string' ||
    !hostedApp.serverId ||
    typeof hostedApp.orgMember !== 'boolean'
  ) {
    throw new Error('id_token_hosted_app_claim_invalid');
  }
  return claims as IdTokenClaims & { sub: string; exp: number };
}

export function sessionFromClaims(input: {
  claims: IdTokenClaims & { sub: string; exp: number };
  appUser: AppUser;
  origin: string;
}): StoredSyfoAuthSession {
  const user: SyfoAuthUser = {
    sub: input.claims.sub,
    ...(input.claims.email ? { email: input.claims.email } : {}),
    ...(input.claims.name ? { name: input.claims.name } : {}),
    ...(input.claims.picture ? { picture: input.claims.picture } : {}),
  };
  return {
    user,
    appUser: input.appUser,
    hostedApp: input.claims[syfoHostedAppClaimName] as SyfoHostedAppClaim,
    expiresAt: input.claims.exp * 1000,
    origin: input.origin,
  };
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1)
    difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function signatureAlgorithm(
  jwk: OAuthJwk,
  alg?: string,
): {
  importAlgorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams;
  verifyAlgorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams;
} {
  const resolved = alg ?? jwk.alg;
  if (resolved === 'EdDSA' && jwk.kty === 'OKP') {
    return { importAlgorithm: { name: 'Ed25519' }, verifyAlgorithm: { name: 'Ed25519' } };
  }
  if (resolved === 'ES256' && jwk.kty === 'EC') {
    return {
      importAlgorithm: { name: 'ECDSA', namedCurve: 'P-256' },
      verifyAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
    };
  }
  if (resolved === 'RS256' && jwk.kty === 'RSA') {
    return {
      importAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      verifyAlgorithm: { name: 'RSASSA-PKCS1-v1_5' },
    };
  }
  throw new Error('id_token_algorithm_unsupported');
}
