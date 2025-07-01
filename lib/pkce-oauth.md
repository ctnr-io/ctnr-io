# PKCE OAuth Authentication for ctnr CLI

## Overview

PKCE (Proof Key for Code Exchange) OAuth implementation for secure CLI authentication using Supabase and GitHub.

## How it works

1. **Token Check**: CLI checks `~/.ctnr/tokens.json` for valid tokens
2. **OAuth Flow**: If no valid tokens, starts PKCE flow:
   - Generate code_verifier and code_challenge
   - Start local server on localhost:8080+
   - Open browser to Supabase OAuth URL
   - User authenticates with GitHub
   - Capture authorization code from callback
   - Exchange code + verifier for tokens
   - Store tokens securely
3. **API Calls**: Use stored tokens for authenticated requests

## Files

- `auth-storage.ts` - Token storage in ~/.ctnr/tokens.json
- `pkce-oauth.ts` - PKCE flow implementation
- `auth.ts` - Main authentication orchestrator

## Usage

Authentication happens automatically:
```bash
# First time - triggers OAuth flow
ctnr run my-container

# Check auth status
ctnr auth:status

# Logout
ctnr auth:logout
```

## Configuration

Set environment variables:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

In Supabase:
- Enable GitHub OAuth provider
- Add redirect URL: `http://localhost:8080/callback`

## Security

- PKCE prevents code interception
- State parameter prevents CSRF
- Tokens stored with 600 permissions
- Automatic token refresh
- 5-minute OAuth timeout

## Testing

```bash
deno run -A --unstable-net test-auth.ts
