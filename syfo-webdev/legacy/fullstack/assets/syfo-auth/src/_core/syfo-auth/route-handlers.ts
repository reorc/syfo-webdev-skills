import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { syfoAuthConfig, syfoAuthCookieOptions, syfoAuthCookies, syfoAuthPaths } from './config';
import { upsertAppUser } from './database';
import { discoverOpenId, exchangeAuthorizationCode, fetchJwks } from './oidc';
import {
  createOAuthTransaction,
  createPkcePair,
  openCookie,
  sealCookie,
  sessionFromClaims,
  validateOAuthTransaction,
  verifyIdToken,
} from './protocol';
import { readSyfoSession } from './server';
import {
  appOriginFromRedirectUri,
  isLogoutAuthorized,
  resolveAppOrigin,
} from './origin';
import type { OAuthTransaction } from './types';

export async function loginRoute(request: NextRequest): Promise<NextResponse> {
  let appOrigin: string;
  try {
    appOrigin = resolveAppOrigin({
      provided: request.nextUrl.searchParams.get('origin'),
      requestOrigin: request.nextUrl.origin,
      isProduction: process.env.NODE_ENV === 'production',
    });
  } catch {
    return NextResponse.json({ error: 'oauth_origin_invalid' }, { status: 400 });
  }
  const config = syfoAuthConfig();
  const discovery = await discoverOpenId(config.issuer);
  const redirectUri = new URL(syfoAuthPaths.callback, appOrigin).toString();
  const { verifier, challenge } = await createPkcePair();
  const transaction = createOAuthTransaction({
    verifier,
    redirectUri,
    returnTo: request.nextUrl.searchParams.get('returnTo') ?? '/',
  });
  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes,
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    syfoAuthCookies.transaction,
    await sealCookie(transaction, config.sessionSecret),
    { ...syfoAuthCookieOptions, maxAge: 10 * 60 },
  );
  return response;
}

async function completeCallback(request: NextRequest): Promise<NextResponse> {
  const oauthError = request.nextUrl.searchParams.get('error');
  if (oauthError)
    return NextResponse.json({ error: 'oauth_authorization_failed' }, { status: 401 });
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'oauth_code_missing' }, { status: 400 });
  const config = syfoAuthConfig();
  const transaction = validateOAuthTransaction(
    await openCookie<OAuthTransaction>(
      request.cookies.get(syfoAuthCookies.transaction)?.value,
      config.sessionSecret,
    ),
    request.nextUrl.searchParams.get('state'),
  );
  const discovery = await discoverOpenId(config.issuer);
  const tokens = await exchangeAuthorizationCode({
    tokenEndpoint: discovery.token_endpoint,
    code,
    verifier: transaction.verifier,
    redirectUri: transaction.redirectUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });
  const claims = await verifyIdToken({
    idToken: tokens.id_token,
    issuer: discovery.issuer,
    clientId: config.clientId,
    hostedAppId: config.hostedAppId,
    nonce: transaction.nonce,
    jwks: await fetchJwks(discovery.jwks_uri),
  });
  const hostedApp = claims['https://syfo.cloud/hosted-app'];
  if (!hostedApp) throw new Error('id_token_hosted_app_claim_missing');
  const appUser = await upsertAppUser({
    issuer: discovery.issuer,
    subject: claims.sub,
    serverId: hostedApp.serverId,
    email: claims.email,
    emailVerified: claims.email_verified,
    name: claims.name,
    picture: claims.picture,
  });
  // The app origin captured at login is sealed into the transaction's redirect_uri. Reuse it
  // for both the post-login redirect and the session binding, never request.nextUrl.origin —
  // behind the runtime edge the latter is the internal bind host.
  const appOrigin = appOriginFromRedirectUri(transaction.redirectUri);
  const session = sessionFromClaims({
    claims,
    appUser,
    origin: appOrigin,
  });
  const response = NextResponse.redirect(new URL(transaction.returnTo, appOrigin));
  response.cookies.delete(syfoAuthCookies.transaction);
  response.cookies.set(syfoAuthCookies.session, await sealCookie(session, config.sessionSecret), {
    ...syfoAuthCookieOptions,
    maxAge: Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)),
  });
  return response;
}

export async function callbackRoute(request: NextRequest): Promise<NextResponse> {
  try {
    return await completeCallback(request);
  } catch {
    const response = NextResponse.json({ error: 'oauth_callback_invalid' }, { status: 401 });
    response.cookies.delete(syfoAuthCookies.transaction);
    response.cookies.delete(syfoAuthCookies.session);
    return response;
  }
}

export async function sessionRoute(request: NextRequest): Promise<NextResponse> {
  const session = await readSyfoSession(request);
  if (!session) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  return NextResponse.json({
    user: session.user,
    appUser: session.appUser,
    hostedApp: session.hostedApp,
    expiresAt: session.expiresAt,
  });
}

export async function logoutRoute(request: NextRequest): Promise<NextResponse> {
  const session = await readSyfoSession(request);
  // No active session: nothing to protect, idempotent success.
  if (!session) return new NextResponse(null, { status: 204 });
  // CSRF: compare the browser Origin against the origin sealed into the session at login
  // (legacy sessions without a sealed origin fall back to Sec-Fetch-Site). Never trust
  // request.nextUrl.origin — behind the runtime edge it is the internal bind host.
  const authorized = isLogoutAuthorized({
    browserOrigin: request.headers.get('origin'),
    sessionOrigin: session.origin ?? null,
    secFetchSite: request.headers.get('sec-fetch-site'),
  });
  if (!authorized) {
    return NextResponse.json({ error: 'csrf_origin_invalid' }, { status: 403 });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete(syfoAuthCookies.session);
  response.cookies.delete(syfoAuthCookies.transaction);
  return response;
}
