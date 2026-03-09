/**
 * oauth.service.ts
 *
 * Implements the OAuth 2.0 Authorization Code flow with PKCE (RFC 7636).
 * No client secret. No backend. Runs entirely in the browser.
 *
 * Scope: https://www.googleapis.com/auth/drive.appdata openid email profile
 *
 * The `prompt=consent` parameter is intentional — it guarantees a refresh_token
 * is returned on every authorization, even if the user has previously granted
 * consent. Do not remove it.
 */

import { ENV, isGoogleDriveConfigured } from '@/config/env';
import type { Result, UUID } from '@/shared/types/common.types';
import {
  loadTokens,
  saveTokens,
  type GoogleTokens,
} from '@/services/storage/google-tokens.storage';
import { useSessionStore } from '@/app/stores/session.store';

export type { GoogleTokens };

// ---------------------------------------------------------------------------
// Internal session-storage key for ephemeral PKCE state
// ---------------------------------------------------------------------------

const OAUTH_STATE_SESSION_KEY = 'zentro_oauth_state';

type OAuthState = {
  codeVerifier: string;
  returnPath: string;
  nonce: string;
};

// ---------------------------------------------------------------------------
// PKCE helpers (pure functions)
// ---------------------------------------------------------------------------

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToBase64Url(digest);
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// OAuth flow
// ---------------------------------------------------------------------------

/**
 * Generates a PKCE code verifier + challenge, stores ephemeral state in
 * sessionStorage, then redirects the browser to Google's authorization page.
 */
export async function initiateOAuthFlow(returnPath: string): Promise<void> {
  if (!isGoogleDriveConfigured) {
    throw new Error(
      'Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_REDIRECT_URI in your .env file.'
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const nonce = generateNonce();

  const state: OAuthState = { codeVerifier, returnPath, nonce };
  sessionStorage.setItem(OAUTH_STATE_SESSION_KEY, JSON.stringify(state));

  const params = new URLSearchParams({
    client_id: ENV.GOOGLE_CLIENT_ID,
    redirect_uri: ENV.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.appdata openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: nonce,
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

/**
 * Decodes the JWT payload segment without verification.
 * Used only to extract `email` and `name` display fields.
 */
function decodeJWTPayload(token: string): Record<string, unknown> {
  try {
    const segment = token.split('.')[1];
    if (!segment) return {};
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Completes the OAuth flow by exchanging the authorization code for tokens.
 * Validates the CSRF nonce before exchanging.
 */
export async function handleOAuthCallback(
  code: string,
  state: string
): Promise<Result<GoogleTokens>> {
  // Read and clear ephemeral state
  const raw = sessionStorage.getItem(OAUTH_STATE_SESSION_KEY);
  sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);

  if (!raw) {
    return {
      success: false,
      error: {
        code: 'OAUTH_STATE_MISSING',
        message: 'OAuth state not found. Possible CSRF attack.',
      },
    };
  }

  let storedState: OAuthState;
  try {
    storedState = JSON.parse(raw) as OAuthState;
  } catch {
    return {
      success: false,
      error: { code: 'OAUTH_STATE_INVALID', message: 'OAuth state is corrupt.' },
    };
  }

  if (storedState.nonce !== state) {
    return {
      success: false,
      error: { code: 'OAUTH_CSRF_FAILED', message: 'State mismatch — possible CSRF attack.' },
    };
  }

  // Exchange code for tokens.
  // Google enforces client_secret even for Desktop app clients despite listing
  // it as "optional" in their docs. For installed/Desktop apps this secret is
  // non-confidential by design — Google does not treat it as a security credential.
  const body = new URLSearchParams({
    code,
    client_id: ENV.GOOGLE_CLIENT_ID,
    client_secret: ENV.GOOGLE_CLIENT_SECRET,
    redirect_uri: ENV.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: storedState.codeVerifier,
  });

  let tokenData: TokenResponse;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: {
          code: 'OAUTH_TOKEN_EXCHANGE_FAILED',
          message: `Token exchange failed: ${errText}`,
        },
      };
    }

    tokenData = (await response.json()) as TokenResponse;
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'OAUTH_NETWORK_ERROR',
        message: 'Network error during token exchange.',
        context: err instanceof Error ? { cause: err.message } : undefined,
      },
    };
  }

  // Decode id_token for email/name (no signature verification needed here)
  const jwtPayload = tokenData.id_token ? decodeJWTPayload(tokenData.id_token) : {};
  const email = typeof jwtPayload.email === 'string' ? jwtPayload.email : '';
  const displayName = typeof jwtPayload.name === 'string' ? jwtPayload.name : email;

  const tokens: GoogleTokens = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? '',
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
    scope: tokenData.scope,
    tokenType: tokenData.token_type,
    email,
    displayName,
  };

  return { success: true, data: tokens };
}

/**
 * Refreshes an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<Result<Pick<GoogleTokens, 'accessToken' | 'expiresAt'>>> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: ENV.GOOGLE_CLIENT_ID,
    client_secret: ENV.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        error: { code: 'GOOGLE_AUTH_EXPIRED', message: 'Failed to refresh access token.' },
      };
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    return {
      success: true,
      data: {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'OAUTH_NETWORK_ERROR',
        message: 'Network error during token refresh.',
        context: err instanceof Error ? { cause: err.message } : undefined,
      },
    };
  }
}

/**
 * Revokes the given access token.
 * Best-effort — failures are silently ignored (tokens expire anyway).
 */
export async function revokeToken(accessToken: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
    });
  } catch {
    // Best-effort: silent failure
  }
}

/**
 * Returns a valid access token for the current user, refreshing if necessary.
 * Returns GOOGLE_AUTH_EXPIRED if the refresh token is also invalid.
 */
export async function getValidAccessToken(userId: UUID): Promise<Result<string>> {
  const { derivedKey } = useSessionStore.getState();
  if (!derivedKey) {
    return {
      success: false,
      error: { code: 'NO_SESSION', message: 'No active session.' },
    };
  }

  const loadResult = await loadTokens(userId, derivedKey);
  if (!loadResult.success) return loadResult;
  if (!loadResult.data) {
    return {
      success: false,
      error: { code: 'GOOGLE_NOT_CONNECTED', message: 'Google Drive is not connected.' },
    };
  }

  const tokens = loadResult.data;
  const BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  if (tokens.expiresAt - Date.now() > BUFFER_MS) {
    return { success: true, data: tokens.accessToken };
  }

  // Token expired or about to expire — refresh
  if (!tokens.refreshToken) {
    return {
      success: false,
      error: { code: 'GOOGLE_AUTH_EXPIRED', message: 'No refresh token available.' },
    };
  }

  const refreshResult = await refreshAccessToken(tokens.refreshToken);
  if (!refreshResult.success) return refreshResult;

  // Persist updated tokens
  const updatedTokens: GoogleTokens = {
    ...tokens,
    accessToken: refreshResult.data.accessToken,
    expiresAt: refreshResult.data.expiresAt,
  };
  await saveTokens(userId, updatedTokens, derivedKey);

  return { success: true, data: refreshResult.data.accessToken };
}
