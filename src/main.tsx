import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/app/App'

// ---------------------------------------------------------------------------
// OAuth callback redirect
// Google redirects to <origin><base>oauth/callback?code=... but the hash
// router only handles <origin><base>#/oauth/callback. Intercept and rewrite
// before React renders so the router can pick up the params.
// ---------------------------------------------------------------------------
const base = import.meta.env.BASE_URL; // e.g. '/zentro/' or '/'
if (window.location.pathname.startsWith(`${base}oauth/callback`)) {
  window.location.replace(
    `${window.location.origin}${base}#/oauth/callback${window.location.search}`,
  );
}

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Root element #root not found in document.');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
