# infra/zitadel

Raw Zitadel SDK wrapper + tenancy auth adapter that can replace Supabase for user/auth management. Zitadel is the
platform OIDC IdP already running at `iam.mk8s.eu`.

## What it is / what it replaces

Supabase in ctnr is used **for auth only** - there is no Supabase database usage (`.from(...)` / `.rpc(...)` appear
nowhere). It provides: OAuth login (GitHub), the access/refresh session, and the user identity (`id`, `email`, `name`,
`avatar`, `createdAt`). Everything else lives outside Supabase:

- **Projects** = Kubernetes namespaces labelled `ctnr.io/owner-id=<user.id>` (`ctx.kube`).
- **Billing / balances** = Mollie + Qonto (`infra/mollie`, `infra/qonto`).

So the Zitadel migration is **identity/session only**. Nothing needs a new data store.

## Layers (adapter, not a rewrite)

| Layer               | Supabase                                                              | Zitadel                                     |
| ------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| Raw SDK wrapper     | `infra/supabase/mod.ts`                                               | `infra/zitadel/mod.ts` (+ `auth-client.ts`) |
| Server auth adapter | `api/context/server/auth.ts` (`...Supabase`)                          | `api/context/server/auth.zitadel.ts`        |
| Client auth adapter | `api/context/client/auth.ts` (`...Supabase`)                          | `api/context/client/auth.zitadel.ts`        |
| Selector            | `api/context/auth-provider.ts` - `AUTH_PROVIDER` (default `supabase`) |                                             |

`createServerAuthContext` / `createClientAuthContext` keep their names and importers; they now dispatch by
`AUTH_PROVIDER`. The `AuthClient` interface in `auth-client.ts` is the port both providers satisfy (the Supabase auth
client matches it structurally).

## Config (env)

| Var                        | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `AUTH_PROVIDER`            | `supabase` (default) or `zitadel`                          |
| `ZITADEL_ISSUER`           | OIDC issuer, e.g. `https://iam.mk8s.eu`                    |
| `ZITADEL_CLIENT_ID`        | public PKCE client id (no secret)                          |
| `ZITADEL_IDP_ID`           | optional: preselect a federated IdP (`idp_hint`)           |
| `ZITADEL_MANAGEMENT_TOKEN` | optional: service-account/PAT for management API user CRUD |

## Switch it on

```sh
# .env
AUTH_PROVIDER="zitadel"
ZITADEL_ISSUER="https://iam.mk8s.eu"
ZITADEL_CLIENT_ID="<zitadel-app-client-id>"

deno task trpc:server:run   # server picks the adapter from AUTH_PROVIDER
deno task ctnr auth login   # client OIDC PKCE flow against Zitadel
```

Revert = set `AUTH_PROVIDER="supabase"` (or unset). Supabase code is untouched.

## Quick checks (static)

```sh
deno fmt infra/zitadel api/context
deno check infra/zitadel/mod.ts infra/zitadel/auth-client.ts \
  api/context/server/auth.ts api/context/client/auth.ts

# OIDC discovery is reachable (expects a JSON doc with token_endpoint)
curl -s "$ZITADEL_ISSUER/.well-known/openid-configuration" | jq .token_endpoint
```

## Load-bearing constraints / traps

- **Do not run the Zitadel user id through `shortUUID`.** Supabase ids are UUIDs and the Supabase adapter shortens them;
  Zitadel `sub` is a numeric snowflake string and is used verbatim as the k8s owner-id label. Existing Supabase-owned
  namespaces carry the shortened UUID, so a live migration needs an id backfill (out of scope here - noted as open
  question).
- **PKCE state** (verifier) is stored in the caller Storage between `signInWithOAuth` and `exchangeCodeForSession`; both
  must run against the same client/storage instance. The terminal flow already does (`login_from_terminal.ts`).
- Context types in `api/context/mod.ts` still name Supabase (`SupabaseClient['auth']`, `Session`); the Zitadel adapter
  absorbs that with contained boundary casts. Unifying the context onto the provider-neutral `AuthClient` port is
  deliberate follow-up.

## Not implemented / untested here

- No live call was made against a Zitadel instance in this branch (no client provisioned); the OIDC + management flows
  are wired but **not runtime-verified**. Static `deno check` passes. Cluster/live validation is the operator's step.
