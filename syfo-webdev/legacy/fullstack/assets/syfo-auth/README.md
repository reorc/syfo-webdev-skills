# Syfo authentication and App-local user starter

Copy this asset's `src/` tree into a full-stack Next.js App Router project and copy
`migrations/0001_syfo_auth_users.sql` into the application's ordered migration set. Files under
`src/_core/` are platform contract code: do not move, rename, expose to client bundles, or bypass them.

Install the server-only TiDB driver:

```bash
pnpm add mysql2
```

Required platform-injected server environment:

```text
SYFO_OAUTH_ISSUER
SYFO_OAUTH_CLIENT_ID
SYFO_HOSTED_APP_ID
SYFO_AUTH_SESSION_SECRET
TIDB_HOST
TIDB_PORT
TIDB_USER
TIDB_PASSWORD
TIDB_DATABASE
```

Production confidential clients additionally receive `SYFO_OAUTH_CLIENT_SECRET`. Never prefix any
secret or TiDB credential with `NEXT_PUBLIC_`. Local disposable databases may set
`SYFO_ALLOW_INSECURE_LOCAL_TIDB=1`; deployed production rejects that override and requires TLS.

The redirect URI contract is:

```text
<app-origin>/api/_core/syfo-auth/callback
```

Application code may consume these stable entry points:

```tsx
import { startLogin, useSyfoAuth } from '@/_core/syfo-auth/client';
import { orgProtectedRoute, protectedRoute } from '@/_core/syfo-auth/server';
import { getCurrentAppUser, requireAppUser } from '@/_core/syfo-auth/database';
```

## Identity model

- Syfo remains the OIDC identity authority.
- The App owns `app_users` in its isolated TiDB database.
- `(issuer, subject)` is the unique stable identity. Never use email as a user key.
- The callback verifies signature, issuer, audience/authorized party, expiry, nonce, and the
  Hosted-App `appId` claim before it writes anything.
- After validation, the callback transactionally upserts the App user and refreshes profile snapshot
  fields (`email`, `email_verified`, `display_name`, `avatar_url`, `last_login_at`).
- App-specific fields belong in separate App-owned tables keyed by `app_users.id`. The included
  `app_user_preferences` table and `example-user-data.ts` demonstrate that pattern.

The browser session endpoint returns only sanitized identity, App-user, Hosted-App membership, and
expiry fields. OAuth access, refresh, and ID tokens exist only during the server callback and are not
stored in `app_users`, the App session cookie, or browser-visible responses. If an App later needs a
Syfo product capability, use a separately designed App-scoped capability API; never reuse the login
token.

Run migrations explicitly during the deploy migration phase. Do not run DDL in the OAuth callback or
ordinary application startup. The migration is repeatable via `CREATE TABLE IF NOT EXISTS`; production
schema evolution should continue with ordered forward-only migrations.
