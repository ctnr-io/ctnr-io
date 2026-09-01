/**
 * @file infra/zitadel/auth-client.ts
 * @description Stateful OIDC auth client for Zitadel that exposes the same surface the ctnr
 * handlers already call on the Supabase auth client (`getSession`, `getUser`, `setSession`,
 * `signInWithOAuth`, `signOut`, `exchangeCodeForSession`). Session + PKCE state persist in the
 * caller-provided Storage, exactly like `@supabase/supabase-js` does.
 *
 * The `AuthClient` interface here is the auth port both adapters conform to; the Supabase auth
 * client satisfies it structurally, and this class implements it for Zitadel.
 */
import {
  buildAuthorizeUrl,
  discoverOidc,
  endSession,
  exchangeCode,
  generatePkce,
  getUserInfo,
  getZitadelConfig,
  type OidcUserInfo,
  refreshTokens,
  type TokenSet,
  type ZitadelConfig,
} from './mod.ts'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface AuthUser {
  id: string
  email: string | null
  user_metadata: { name?: string; avatar_url?: string; [k: string]: unknown }
  app_metadata: { user_name?: string; [k: string]: unknown }
  created_at: string
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_in: number
  /** Unix seconds. */
  expires_at: number
  token_type: string
  user: AuthUser
}

export interface AuthResult<T> {
  data: T
  error: { message: string } | null
}

/** The subset of the auth client surface the ctnr handlers depend on. */
export interface AuthClient {
  getSession(): Promise<AuthResult<{ session: AuthSession | null }>>
  getUser(): Promise<AuthResult<{ user: AuthUser | null }>>
  setSession(
    tokens: { access_token: string; refresh_token: string },
  ): Promise<AuthResult<{ session: AuthSession | null; user: AuthUser | null }>>
  signInWithOAuth(
    opts: { provider: string; options?: { redirectTo?: string; scopes?: string } },
  ): Promise<AuthResult<{ url: string | null; provider: string }>>
  exchangeCodeForSession(code: string): Promise<AuthResult<{ session: AuthSession | null }>>
  signOut(): Promise<AuthResult<Record<never, never>>>
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } }
}

const SESSION_KEY = 'ctnr.zitadel.session'
const PKCE_KEY = 'ctnr.zitadel.pkce'

export class ZitadelAuthClient implements AuthClient {
  #storage: Storage
  #config: ZitadelConfig

  constructor(storage: Storage, config: ZitadelConfig = getZitadelConfig()) {
    this.#storage = storage
    this.#config = config
  }

  async getSession(): Promise<AuthResult<{ session: AuthSession | null }>> {
    try {
      const session = await this.#loadSession()
      return { data: { session }, error: null }
    } catch (error) {
      return { data: { session: null }, error: toError(error) }
    }
  }

  async getUser(): Promise<AuthResult<{ user: AuthUser | null }>> {
    const { session } = (await this.getSession()).data
    return { data: { user: session?.user ?? null }, error: null }
  }

  async setSession(
    tokens: { access_token: string; refresh_token: string },
  ): Promise<AuthResult<{ session: AuthSession | null; user: AuthUser | null }>> {
    try {
      const discovery = await discoverOidc(this.#config.issuer)
      const info = await getUserInfo(discovery, tokens.access_token)
      const session = this.#toSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: 'bearer',
        expires_in: 0,
      }, info)
      this.#storage.setItem(SESSION_KEY, JSON.stringify(session))
      return { data: { session, user: session.user }, error: null }
    } catch (error) {
      return { data: { session: null, user: null }, error: toError(error) }
    }
  }

  async signInWithOAuth(
    opts: { provider: string; options?: { redirectTo?: string; scopes?: string } },
  ): Promise<AuthResult<{ url: string | null; provider: string }>> {
    try {
      const redirectUri = opts.options?.redirectTo
      if (!redirectUri) {
        throw new Error('redirectTo is required for the OIDC authorization flow')
      }
      const discovery = await discoverOidc(this.#config.issuer)
      const pkce = await generatePkce()
      const state = crypto.randomUUID()
      this.#storage.setItem(PKCE_KEY, JSON.stringify({ verifier: pkce.verifier, redirectUri, state }))
      const url = buildAuthorizeUrl(this.#config, discovery, {
        redirectUri,
        codeChallenge: pkce.challenge,
        state,
        scopes: opts.options?.scopes ? `openid profile email offline_access ${opts.options.scopes}` : undefined,
      })
      return { data: { url, provider: opts.provider }, error: null }
    } catch (error) {
      return { data: { url: null, provider: opts.provider }, error: toError(error) }
    }
  }

  async exchangeCodeForSession(code: string): Promise<AuthResult<{ session: AuthSession | null }>> {
    try {
      const raw = this.#storage.getItem(PKCE_KEY)
      if (!raw) {
        throw new Error('No PKCE verifier found; start the login flow first')
      }
      const { verifier, redirectUri } = JSON.parse(raw) as { verifier: string; redirectUri: string }
      const discovery = await discoverOidc(this.#config.issuer)
      const tokens = await exchangeCode(this.#config, discovery, { code, redirectUri, codeVerifier: verifier })
      const info = await getUserInfo(discovery, tokens.access_token)
      const session = this.#toSession(tokens, info)
      this.#storage.setItem(SESSION_KEY, JSON.stringify(session))
      this.#storage.removeItem(PKCE_KEY)
      return { data: { session }, error: null }
    } catch (error) {
      return { data: { session: null }, error: toError(error) }
    }
  }

  async signOut(): Promise<AuthResult<Record<never, never>>> {
    try {
      const session = await this.#loadSession().catch(() => null)
      this.#storage.removeItem(SESSION_KEY)
      this.#storage.removeItem(PKCE_KEY)
      if (session) {
        const discovery = await discoverOidc(this.#config.issuer)
        await endSession(discovery, {})
      }
      return { data: {}, error: null }
    } catch (error) {
      return { data: {}, error: toError(error) }
    }
  }

  // Supabase-compatible surface the ctnr client subscribes to. Zitadel has no live auth-event stream
  // (session lives in storage), so there is nothing to push; return an inert unsubscribe handle so the
  // caller's `data.subscription.unsubscribe()` cleanup works. Auth changes are picked up on next reload.
  onAuthStateChange(
    _callback: (event: string, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } } {
    return { data: { subscription: { unsubscribe: () => {} } } }
  }

  async #loadSession(): Promise<AuthSession | null> {
    const raw = this.#storage.getItem(SESSION_KEY)
    if (!raw) {
      return null
    }
    const session = JSON.parse(raw) as AuthSession
    if (session.expires_at && session.expires_at * 1000 < Date.now() && session.refresh_token) {
      return await this.#refresh(session.refresh_token)
    }
    return session
  }

  async #refresh(refreshToken: string): Promise<AuthSession | null> {
    const discovery = await discoverOidc(this.#config.issuer)
    const tokens = await refreshTokens(this.#config, discovery, refreshToken)
    const info = await getUserInfo(discovery, tokens.access_token)
    const session = this.#toSession(tokens, info)
    this.#storage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }

  #toSession(tokens: TokenSet, info: OidcUserInfo): AuthSession {
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? '',
      expires_in: tokens.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + (tokens.expires_in || 0),
      token_type: tokens.token_type || 'bearer',
      user: toAuthUser(info),
    }
  }
}

export function toAuthUser(info: OidcUserInfo): AuthUser {
  return {
    id: info.sub,
    email: info.email ?? null,
    user_metadata: {
      name: info.name ?? info.preferred_username,
      avatar_url: info.picture,
    },
    app_metadata: {
      user_name: info.preferred_username,
    },
    created_at: info.updated_at ? new Date(info.updated_at * 1000).toISOString() : new Date().toISOString(),
  }
}

function toError(error: unknown): { message: string } {
  return { message: error instanceof Error ? error.message : String(error) }
}
