export type SyfoHostedAppClaim = {
  appId: string;
  serverId: string;
  orgMember: boolean;
};

export type SyfoAuthUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type AppUser = {
  id: string;
  issuer: string;
  subject: string;
  serverId: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

export type SyfoAuthSession = {
  user: SyfoAuthUser;
  appUser: AppUser;
  hostedApp: SyfoHostedAppClaim;
  expiresAt: number;
};

// The origin the user authenticated from, sealed into the session cookie and used for the
// logout CSRF check. Optional so sessions issued before this field existed still decode
// (those legacy sessions fall back to a Sec-Fetch-Site same-origin check on logout).
export type StoredSyfoAuthSession = SyfoAuthSession & { origin?: string };

export type OAuthTransaction = {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  returnTo: string;
  expiresAt: number;
};

export type OpenIdConfiguration = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type OAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token: string;
};

export type OAuthJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
};
