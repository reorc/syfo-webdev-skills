# Access, identity, and authorization

Use three separate layers. Never collapse them into a single “auth” choice.

## Layer 1: platform access

The Hosted App platform gate controls who may open the whole website through its managed domain:

| Level | Platform meaning | Typical fit |
|---|---|---|
| `public` | Anyone may open the website without signing in. | Public information sites and external products with anonymous pages. |
| `authenticated` | Any signed-in Syfo user, including users outside the owning organization. | Syfo-wide products where every visitor must have a Syfo account. |
| `org` | Any active member of the owning organization. | Internal tools for the whole organization. |
| `org_members` | Only selected active members of the owning organization. | Restricted internal tools for a named subset. |

This is one whole-website gate, not a page or business-record permission system. It does not add a
“Sign in with Syfo” button, create an App-local user, or decide which records and actions the user may
access after entry.

Recommend the level from the product mode:

- Internal tool: default to `org`; use `org_members` only for a named subset.
- External product: use `public` when anonymous acquisition or public pages exist; use
  `authenticated` only when every visitor must already be a signed-in Syfo user.
- Public information website: use `public`.

For an existing website, read the current policy and preserve it unless the human explicitly asks to
change it. Access changes are a separate human-owned action in the management UI; code work, OAuth,
database enablement, and deployment never authorize a policy change.

## Layer 2: Syfo OAuth identity

Use Syfo OAuth only when application code must identify the acting user—for example personal data,
per-user ownership, App roles, preferences, or audit attribution.

- `public` may still use Syfo OAuth on account-only routes while public pages remain anonymous.
- `authenticated`, `org`, and `org_members` may require platform sign-in to enter, but App code still
  needs its own OAuth flow when it needs an App-local user identity.
- A pure public information website normally needs no OAuth.

When OAuth is required, use the official `assets/syfo-auth` starter and fixed callback contract. The
starter stores App-local users in the website's cloud database, so database provisioning remains a
separate consent gate. Do not recreate the callback or expose OAuth tokens to browser code.

## Layer 3: App-owned authorization

OAuth proves identity; the App decides authorization. Define protected resources, actions, and roles
before implementation, then enforce them in every server route and mutation that reads or changes
protected data.

- `protectedRoute` proves that an App session exists; it does not grant business permissions.
- `orgProtectedRoute` additionally checks the signed login-time `orgMember` claim; it is not a
  substitute for record ownership, App roles, subscription state, or other business rules.
- UI hiding, disabled controls, and route navigation mirror authorization but never replace the
  server check.
- Default deny when the App cannot prove the required role, ownership, or entitlement.

Do not introduce a machine API or API-key lifecycle unless the user separately requests a concrete
non-browser caller. Current Hosted App access and Syfo OAuth are human-access mechanisms, not a
general machine-credential product.

## Security plan

Record this before coding and include it in handoff:

```text
product_mode: internal_tool | external_product | public_information
platform_access: public | authenticated | org | org_members
platform_access_reason: <why this whole-website gate fits>
access_change_authorized: yes | no | not_needed
syfo_oauth: required | not_required
identity_reason: <what App code needs to know about the user>
app_authorization: <roles, ownership, entitlements, and default-deny rules>
public_routes: <anonymous routes, if any>
protected_routes: <server routes/actions and their required checks>
```

Examples:

- Internal operations dashboard: `org` + Syfo OAuth + App roles such as admin/operator.
- Restricted finance tool: `org_members` + Syfo OAuth + App role and record-scope checks.
- External member product with public landing pages: `public` + Syfo OAuth on account routes +
  subscription and data-ownership checks.
- Public campaign site: `public` + no OAuth + no user ACL.
