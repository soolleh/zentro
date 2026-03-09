/**
 * env.ts
 *
 * Centralised access to Vite environment variables.
 * All env vars are resolved at compile time and are safe to tree-shake.
 *
 * GOOGLE_CLIENT_SECRET: Google enforces this even for Desktop app (installed
 * app) OAuth clients despite their docs listing it as optional. For Desktop
 * app clients it is non-confidential by design — Google explicitly acknowledges
 * it cannot be kept secret in distributed apps and does not treat it as an
 * authentication credential. This is not the same risk as a Web Application
 * client_secret. See: https://www.rfc-editor.org/rfc/rfc8252#section-8.5
 */

export const ENV = {
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? '',
  IS_DEV: import.meta.env.DEV,
} as const;

/**
 * True only when all env vars required for Google Drive are non-empty.
 * Use this to conditionally render or disable the Drive connect UI.
 */
export const isGoogleDriveConfigured =
  Boolean(ENV.GOOGLE_CLIENT_ID) &&
  Boolean(ENV.GOOGLE_CLIENT_SECRET) &&
  Boolean(ENV.GOOGLE_REDIRECT_URI);
