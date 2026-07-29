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

export type StoredSyfoAuthSession = SyfoAuthSession;

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
