// Origin handling for the Syfo OAuth flow. Pure, dependency-free helpers (no `server-only`)
// so they can be unit-tested directly.
//
// Behind the runtime edge the Next server sees an internal bind host (e.g.
// https://0.0.0.0:9000) as `request.nextUrl.origin`. That value must never be used to build
// an OAuth redirect_uri or to authorize a logout. The browser's `window.location.origin` is
// the only authoritative public origin; the login route forwards it, and it is sealed into
// the transaction and session so later steps compare against a trusted value.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// Unspecified / wildcard bind addresses — never a valid browsing origin (this is exactly the
// 0.0.0.0:9000 symptom), rejected as defense in depth.
const UNSPECIFIED_HOSTS = new Set(['0.0.0.0', '[::]']);

// Validate a browser-supplied origin (from window.location.origin). Returns the normalized
// bare origin, or throws if it is not a secure, bare origin.
export function sanitizeBrowserOrigin(provided: string): string {
  const url = new URL(provided);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('oauth_origin_invalid');
  }
  if (UNSPECIFIED_HOSTS.has(url.hostname)) {
    throw new Error('oauth_origin_invalid');
  }
  const isLocalHttp = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('oauth_origin_insecure');
  }
  return url.origin;
}

// Constrain the development-only fallback origin. Even in dev the request origin must not be
// trusted blindly (it could be an internal bind host or an attacker-controlled Host header);
// only loopback dev hosts are allowed.
export function sanitizeLocalDevelopmentOrigin(origin: string): string {
  const url = new URL(origin);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('oauth_origin_non_local_fallback');
  }
  return sanitizeBrowserOrigin(origin);
}

// Resolve the app's public origin for the login flow. Prefer the browser-supplied origin.
// In production a missing origin fails closed — falling back to the internal request origin
// would recreate the unreachable-callback bug. In development the fallback is allowed only for
// loopback hosts, never an arbitrary request origin.
export function resolveAppOrigin(input: {
  provided: string | null;
  requestOrigin: string;
  isProduction: boolean;
}): string {
  if (!input.provided) {
    if (input.isProduction) throw new Error('oauth_origin_required');
    return sanitizeLocalDevelopmentOrigin(input.requestOrigin);
  }
  return sanitizeBrowserOrigin(input.provided);
}

// The app origin captured at login is sealed into the transaction's redirect_uri; recover it
// for the post-login redirect and session binding. Re-run it through the same origin
// validation so a transaction sealed by older code (which could carry the internal bind host)
// fails closed instead of redirecting to / sealing an internal origin.
export function appOriginFromRedirectUri(redirectUri: string): string {
  return sanitizeBrowserOrigin(new URL(redirectUri).origin);
}

// Logout CSRF decision. request.nextUrl.origin is untrustworthy behind the edge, so:
// - sessions that sealed an origin (current): require an exact match of the browser Origin.
// - legacy sessions without a sealed origin: fail-safe — accept only when the browser reports
//   a same-site fetch (Sec-Fetch-Site), blocking cross-origin mutation while still allowing a
//   same-origin logout to clear the cookie.
export function isLogoutAuthorized(input: {
  browserOrigin: string | null;
  sessionOrigin: string | null;
  secFetchSite: string | null;
}): boolean {
  if (input.sessionOrigin) {
    return input.browserOrigin !== null && input.browserOrigin === input.sessionOrigin;
  }
  return input.secFetchSite === 'same-origin';
}
