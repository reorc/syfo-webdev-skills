import 'server-only';
import type { OAuthJwk, OAuthTokenResponse, OpenIdConfiguration } from './types';

let discoveryCache: { issuer: string; value: OpenIdConfiguration } | undefined;

export async function discoverOpenId(issuer: string): Promise<OpenIdConfiguration> {
  if (discoveryCache?.issuer === issuer) return discoveryCache.value;
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`oidc_discovery_failed:${response.status}`);
  const value = (await response.json()) as OpenIdConfiguration;
  if (value.issuer !== issuer) throw new Error('oidc_discovery_issuer_mismatch');
  discoveryCache = { issuer, value };
  return value;
}

export async function exchangeAuthorizationCode(input: {
  tokenEndpoint: string;
  code: string;
  verifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
}): Promise<OAuthTokenResponse> {
  const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' });
  if (input.clientSecret)
    headers.set('authorization', `Basic ${btoa(`${input.clientId}:${input.clientSecret}`)}`);
  const response = await fetch(input.tokenEndpoint, {
    method: 'POST',
    headers,
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.verifier,
      redirect_uri: input.redirectUri,
      ...(input.clientSecret ? {} : { client_id: input.clientId }),
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`oauth_token_exchange_failed:${response.status}`);
  const tokens = (await response.json()) as OAuthTokenResponse;
  if (!tokens.access_token || !tokens.id_token) throw new Error('oauth_token_response_invalid');
  return tokens;
}

export async function fetchJwks(jwksUri: string): Promise<OAuthJwk[]> {
  const response = await fetch(jwksUri, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`oidc_jwks_failed:${response.status}`);
  const body = (await response.json()) as { keys?: OAuthJwk[] };
  if (!Array.isArray(body.keys)) throw new Error('oidc_jwks_invalid');
  return body.keys;
}
