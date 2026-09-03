# infra/zitadel

Raw Zitadel SDK wrapper + the auth adapter that provides user/auth management for ctnr. Zitadel is the platform OIDC IdP
running at `iam.mk8s.eu`, and is the sole identity provider.

## What it is

Auth in ctnr is **identity/session only** - there is no auth-provider database usage. Zitadel provides: OAuth login
(GitHub, federated), the access/refresh session, and the user identity (`id`, `email`, `name`, `avatar`, `createdAt`).
Everything else lives elsewhere:

- **Projects** = Kubernetes namespaces labelled `ctnr.io/owner-id=<user.id>` (`ctx.kube`).
- **Billing / balances** = Mollie + Qonto (`infra/mollie`, `infra/qonto`).

## Layers

| Layer               | File                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| Raw SDK wrapper     | `infra/zitadel/mod.ts` (OIDC/OAuth + management API)                          |
| Auth client (port)  | `infra/zitadel/auth-client.ts` (`AuthClient` interface + `ZitadelAuthClient`) |
| Server auth adapter | `api/context/server/auth.ts`                                                  |
| Client auth adapter | `api/context/client/auth.ts`                                                  |

`AuthClient` in `auth-client.ts` is the auth port the app depends on; `ZitadelAuthClient` is its sole implementation.
`createServerAuthContext` / `createClientAuthContext` build the `ctx.auth` context from it.

## Config (env)

| Var                        | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `ZITADEL_ISSUER`           | OIDC issuer, e.g. `https://iam.mk8s.eu`                    |
| `ZITADEL_CLIENT_ID`        | public PKCE client id (no secret)                          |
| `ZITADEL_IDP_ID`           | optional: preselect a federated IdP (`idp_hint`)           |
| `ZITADEL_MANAGEMENT_TOKEN` | optional: service-account/PAT for management API user CRUD |

```sh
# .env
ZITADEL_ISSUER="https://iam.mk8s.eu"
ZITADEL_CLIENT_ID="<zitadel-app-client-id>"

deno task trpc:server:run   # server validates request tokens against Zitadel
deno task ctnr auth login   # client OIDC PKCE flow against Zitadel
```

## Quick checks (static)

```sh
deno fmt infra/zitadel api/context
deno check infra/zitadel/mod.ts infra/zitadel/auth-client.ts \
  api/context/server/auth.ts api/context/client/auth.ts

# OIDC discovery is reachable (expects a JSON doc with token_endpoint)
curl -s "$ZITADEL_ISSUER/.well-known/openid-configuration" | jq .token_endpoint
```

## Load-bearing constraints / traps

- **Do not run the Zitadel user id through `shortUUID`.** The Zitadel `sub` is a numeric snowflake string and is used
  verbatim as the k8s owner-id label (`ctnr.io/owner-id`). Shortening it would break ownership lookups.
- **PKCE state** (verifier) is stored in the caller Storage between `signInWithOAuth` and `exchangeCodeForSession`; both
  must run against the same client/storage instance. On web the verifier lives in `localStorage`, so it survives the
  full-page redirect to `auth/callback`, which completes the exchange on the same mounted client.
- **`onAuthStateChange`** drives the app: the trpc client provider subscribes to it and rebuilds `ctx` on `SIGNED_IN` /
  `SIGNED_OUT` / `TOKEN_REFRESHED`. A code exchange that does not fire it leaves the app stuck on the login page.

## Not runtime-verified here

- OIDC + management flows are wired but depend on a registered Zitadel OIDC app for `app.ctnr.io` (client id, redirect
  URIs). Static `deno check` passes; live login validation is the operator's step once the app is registered.
