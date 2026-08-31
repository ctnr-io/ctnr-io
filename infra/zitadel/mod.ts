/**
 * @file infra/zitadel/mod.ts
 * @description Raw Zitadel SDK wrapper: OIDC/OAuth primitives + Zitadel management API.
 *
 * This is the infra-level equivalent of `infra/supabase/mod.ts`: it only knows how to talk
 * to a Zitadel instance over HTTP. It holds no ctnr domain concepts; the tenancy adapters
 * (the auth.zitadel.ts files under api/context) wrap these primitives into the auth context.
 *
 * Everything is config-driven from env (issuer / client id), never hardcoded.
 */
import process from 'node:process'

// base64url of raw bytes, without the @std/encoding (JSR) dep so this file also bundles for the Expo web
// build (Metro can't resolve JSR specifiers). btoa exists in both Deno and the browser.
function encodeBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface ZitadelConfig {
  /** OIDC issuer URL, e.g. https://iam.mk8s.eu */
  issuer: string
  /** OIDC public client id (PKCE, no secret). */
  clientId: string
  /** Optional IdP id to preselect on the login page (e.g. a GitHub federation). */
  idpId?: string
  /** Optional service-account / PAT bearer token for the management API (user CRUD). */
  managementToken?: string
}

export function getZitadelConfig(): ZitadelConfig {
  const issuer = process.env.ZITADEL_ISSUER
  const clientId = process.env.ZITADEL_CLIENT_ID

  if (!issuer || !clientId) {
    throw new Error('ZITADEL_ISSUER and ZITADEL_CLIENT_ID environment variables are required')
  }

  return {
    issuer: issuer.replace(/\/$/, ''),
    clientId,
    idpId: process.env.ZITADEL_IDP_ID || undefined,
    managementToken: process.env.ZITADEL_MANAGEMENT_TOKEN || undefined,
  }
}

export interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  end_session_endpoint?: string
  revocation_endpoint?: string
}

const discoveryCache = new Map<string, OidcDiscovery>()

export async function discoverOidc(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer)
  if (cached) {
    return cached
  }
  const res = await fetch(`${issuer}/.well-known/openid-configuration`)
  if (!res.ok) {
    throw new Error(`OIDC discovery failed for ${issuer}: ${res.status} ${res.statusText}`)
  }
  const discovery = await res.json() as OidcDiscovery
  discoveryCache.set(issuer, discovery)
  return discovery
}

export interface TokenSet {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type: string
  /** Seconds until expiry. */
  expires_in: number
}

export interface Pkce {
  verifier: string
  challenge: string
}

export async function generatePkce(): Promise<Pkce> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const verifier = encodeBase64Url(bytes)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = encodeBase64Url(new Uint8Array(digest))
  return { verifier, challenge }
}

export function buildAuthorizeUrl(config: ZitadelConfig, discovery: OidcDiscovery, opts: {
  redirectUri: string
  codeChallenge: string
  state: string
  scopes?: string
}): string {
  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', opts.scopes ?? 'openid profile email offline_access')
  url.searchParams.set('code_challenge', opts.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', opts.state)
  if (config.idpId) {
    url.searchParams.set('idp_hint', config.idpId)
  }
  return url.toString()
}

export async function exchangeCode(config: ZitadelConfig, discovery: OidcDiscovery, opts: {
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: config.clientId,
    code_verifier: opts.codeVerifier,
  })
  return await postToken(discovery, body)
}

export async function refreshTokens(
  config: ZitadelConfig,
  discovery: OidcDiscovery,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
  })
  return await postToken(discovery, body)
}

async function postToken(discovery: OidcDiscovery, body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Token endpoint error: ${res.status} ${detail}`)
  }
  return await res.json() as TokenSet
}

export interface OidcUserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string
  picture?: string
  updated_at?: number
}

export async function getUserInfo(discovery: OidcDiscovery, accessToken: string): Promise<OidcUserInfo> {
  const res = await fetch(discovery.userinfo_endpoint, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Userinfo endpoint error: ${res.status} ${res.statusText}`)
  }
  return await res.json() as OidcUserInfo
}

export async function endSession(
  discovery: OidcDiscovery,
  opts: { idToken?: string; postLogoutRedirectUri?: string },
): Promise<void> {
  if (!discovery.end_session_endpoint) {
    return
  }
  const url = new URL(discovery.end_session_endpoint)
  if (opts.idToken) {
    url.searchParams.set('id_token_hint', opts.idToken)
  }
  if (opts.postLogoutRedirectUri) {
    url.searchParams.set('post_logout_redirect_uri', opts.postLogoutRedirectUri)
  }
  await fetch(url.toString()).catch(() => {})
}

/**
 * Zitadel management API (user CRUD). Requires `managementToken`.
 * Uses the v2 users API: https://zitadel.com/docs/apis/resources/user_service_v2
 */
export interface ZitadelUser {
  id: string
  email?: string
  displayName?: string
  userName?: string
  avatarUrl?: string
  createdAt?: string
}

function managementHeaders(config: ZitadelConfig): HeadersInit {
  if (!config.managementToken) {
    throw new Error('ZITADEL_MANAGEMENT_TOKEN is required for management API calls')
  }
  return {
    authorization: `Bearer ${config.managementToken}`,
    'content-type': 'application/json',
  }
}

export async function getUserById(config: ZitadelConfig, userId: string): Promise<ZitadelUser | null> {
  const res = await fetch(`${config.issuer}/v2/users/${userId}`, { headers: managementHeaders(config) })
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Zitadel getUserById error: ${res.status} ${res.statusText}`)
  }
  const body = await res.json() as { user?: RawZitadelUser }
  return body.user ? mapRawUser(body.user) : null
}

export async function createHumanUser(config: ZitadelConfig, input: {
  email: string
  givenName: string
  familyName: string
  userName?: string
}): Promise<ZitadelUser> {
  const res = await fetch(`${config.issuer}/v2/users/human`, {
    method: 'POST',
    headers: managementHeaders(config),
    body: JSON.stringify({
      username: input.userName ?? input.email,
      profile: { givenName: input.givenName, familyName: input.familyName },
      email: { email: input.email },
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Zitadel createHumanUser error: ${res.status} ${detail}`)
  }
  const body = await res.json() as { userId: string }
  return { id: body.userId, email: input.email, userName: input.userName ?? input.email }
}

export async function deleteUser(config: ZitadelConfig, userId: string): Promise<void> {
  const res = await fetch(`${config.issuer}/v2/users/${userId}`, {
    method: 'DELETE',
    headers: managementHeaders(config),
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zitadel deleteUser error: ${res.status} ${res.statusText}`)
  }
}

interface RawZitadelUser {
  userId: string
  human?: {
    email?: { email?: string }
    profile?: { displayName?: string; avatarUrl?: string }
  }
  username?: string
  details?: { creationDate?: string }
}

function mapRawUser(raw: RawZitadelUser): ZitadelUser {
  return {
    id: raw.userId,
    email: raw.human?.email?.email,
    displayName: raw.human?.profile?.displayName,
    userName: raw.username,
    avatarUrl: raw.human?.profile?.avatarUrl,
    createdAt: raw.details?.creationDate,
  }
}
