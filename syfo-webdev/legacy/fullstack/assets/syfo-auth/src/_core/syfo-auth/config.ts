import 'server-only';

export { syfoAuthPaths } from './paths';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Syfo authentication`);
  return value;
}

export function syfoAuthConfig() {
  const issuer = required('SYFO_OAUTH_ISSUER').replace(/\/$/, '');
  return {
    issuer,
    clientId: required('SYFO_OAUTH_CLIENT_ID'),
    hostedAppId: required('SYFO_HOSTED_APP_ID'),
    clientSecret: process.env.SYFO_OAUTH_CLIENT_SECRET,
    sessionSecret: required('SYFO_AUTH_SESSION_SECRET'),
    scopes: 'openid profile email',
  };
}

export const syfoAuthCookies = {
  transaction: 'syfo_oauth_transaction',
  session: 'syfo_auth_session',
} as const;

export const syfoAuthCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
