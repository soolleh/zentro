# INSTRUCTIONS.md — Zentro Personal Finance PWA

> This document is the single source of truth for the Zentro project.
> It is a living requirement document and an execution guide for coding agents.
> All decisions must align with the principles and constraints defined here.

---

## 1. PROJECT IDENTITY

- **Name:** Zentro
- **Type:** Progressive Web Application (PWA)
- **Stack:** React + TypeScript
- **Hosting:** Static (GitHub Pages or equivalent)
- **Backend:** None. Zero.
- **Sync:** None. Each browser profile is an independent instance.

Zentro is a production-grade, fully client-side personal finance application. It must feel serious, secure, and trustworthy — not experimental or prototype-like.

---

## 2. CORE PRINCIPLES

These principles govern every decision in this project. No feature, component, or architectural choice may violate them.

| Principle | Mandate |
|---|---|
| Offline-first | The app must be fully functional with zero network access |
| Privacy-first | No user data leaves the device — ever |
| Encrypted at rest | All financial data encrypted before storage |
| Performance | Must scale to one million+ transactions without degradation |
| Installable | Must meet PWA installability criteria on all major platforms |
| Multi-user | Multiple local user profiles per browser instance |
| Accessibility | WCAG 2.1 AA minimum compliance |

---

## 3. TECHNOLOGY CONSTRAINTS

### 3.1 Mandated Stack
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS with shadcn/ui component library
- **Charting:** Recharts
- **Storage:** IndexedDB (all persistent data)
- **Encryption:** WebCrypto API — AES-GCM
- **Auth (Biometric):** WebAuthn API
- **Service Worker:** Workbox

### 3.2 Prohibited
- No backend services of any kind
- No REST or GraphQL APIs
- No cloud storage (Firebase, Supabase, AWS, etc.)
- No remote push notification servers
- No analytics or telemetry SDKs
- No localStorage for sensitive data
- No sessionStorage for financial data
- No plaintext financial data anywhere in IndexedDB

### 3.3 TypeScript
- Strict mode enforced (`strict: true` in tsconfig)
- No `any` types permitted
- All data models must be fully typed
- All async operations must handle error states explicitly

---

## 4. THEME & DESIGN SYSTEM

### 4.1 Selected Theme: Arctic Zinc

The visual identity of Zentro is **Arctic Zinc** — a light, clinical, premium aesthetic inspired by Apple's design language.

**CSS Custom Properties (source of truth):**

```css
:root {
  --background: 200 10% 98%;
  --foreground: 200 15% 8%;
  --card: 0 0% 100%;
  --card-foreground: 200 15% 8%;
  --popover: 0 0% 100%;
  --popover-foreground: 200 15% 8%;
  --primary: 192 90% 38%;
  --primary-foreground: 0 0% 100%;
  --secondary: 200 10% 93%;
  --secondary-foreground: 200 15% 25%;
  --muted: 200 10% 94%;
  --muted-foreground: 200 10% 45%;
  --accent: 192 90% 38%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 55%;
  --destructive-foreground: 0 0% 100%;
  --border: 200 10% 88%;
  --input: 200 10% 88%;
  --ring: 192 90% 38%;
  --radius: 0.75rem;
  --chart-1: 192 90% 38%;
  --chart-2: 245 75% 62%;
  --chart-3: 35 90% 55%;
  --chart-4: 155 65% 42%;
  --chart-5: 320 65% 58%;
}
```

### 4.2 Design Principles

- **Whitespace:** Generous. Never cramped.
- **Shadows:** Soft, subtle. Use elevation purposefully.
- **Border radius:** 12px default (`--radius: 0.75rem`). Consistent throughout.
- **Typography:** Strong hierarchy. Clear distinction between heading, body, caption, and label sizes.
- **Motion:** Subtle transitions only (100–200ms). No decorative animations.
- **Icons:** Single icon library throughout (Lucide React). No mixing.
- **Density:** Mobile layouts are spacious. Desktop layouts increase information density for analytics views.

### 4.3 Color Usage Rules

- Primary cyan is used for: CTAs, active states, progress indicators, chart primary series.
- Destructive red is used for: deletions, negative balances, overdrawn states, error messages.
- Muted tones are used for: secondary text, disabled states, empty states.
- Green (`--chart-4`) is used exclusively for: income, positive changes, goal completion.
- Never use color as the sole indicator of meaning — always pair with text or icon.

### 4.4 Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| < 640px | Mobile layout. Single column. Bottom navigation. |
| 640px–1024px | Tablet. Sidebar collapses. Moderate density. |
| > 1024px | Desktop. Persistent sidebar. Dense analytics. |

---

## 5. ARCHITECTURE

### 5.1 Application Layers

The application must maintain strict separation across these layers:

```
UI Layer          → React components, pages, layouts
State Layer       → Global state management (Zustand preferred)
Service Layer     → Business logic, computation, data transformation
Storage Layer     → IndexedDB access, encryption/decryption
Crypto Layer      → Key derivation, encryption, decryption primitives
Auth Layer        → Session management, biometric integration
PWA Layer         → Service worker, cache, notifications
```

No layer may directly access a layer more than one step away. UI components must never interact with storage or crypto directly.

### 5.2 Data Flow

All data written to IndexedDB must be encrypted. All data read from IndexedDB must be decrypted before reaching the service layer. The UI layer must never receive or handle encrypted blobs.

### 5.3 State Management

- Global state for: current user session, active account, UI preferences, theme.
- Local component state for: form inputs, UI toggles, transient interactions.
- No global state for: raw IndexedDB records. These must be fetched via the service layer.

### 5.4 Routing

- Client-side routing only (React Router v6+).
- All routes are protected except: Login, Register, and Onboarding.
- Route guards must verify active session before rendering any financial view.
- Deep links must redirect to login if no active session exists.

### 5.5 Error Boundaries

- Every major page and feature module must be wrapped in an error boundary.
- Errors must be caught gracefully with a user-friendly fallback UI.
- Crypto failures must never silently pass — they must surface as actionable errors.

---

## 6. AUTHENTICATION & SECURITY

### 6.1 Local Account System

- Users register with email (identifier only, never transmitted) and password.
- Multiple user profiles supported per browser instance.
- User list stored in IndexedDB (non-encrypted profile metadata only — email hash, display name).
- Passwords are salted and hashed using a strong KDF before storage.
- The encryption key for financial data is derived from the user's password — not stored directly.

### 6.2 Session Management

- Active session held in memory only. Never persisted to disk in plaintext.
- Inactivity timeout: configurable, default 5 minutes.
- On lock: derived key is purged from memory. User must re-authenticate to resume.
- On tab close: session is not automatically resumed — user must log in again.

### 6.3 Biometric Authentication (WebAuthn)

- Biometrics are an optional, secondary convenience layer.
- Supported: Face ID, Touch ID, Windows Hello, Android Biometrics, FIDO2 hardware keys.
- Biometric enrollment requires the user to first authenticate via password.
- Biometric credential is used to retrieve a stored encrypted key blob — not to replace the KDF.
- Feature must degrade gracefully when WebAuthn is unavailable.
- Must use platform authenticator preference with external key fallback.

### 6.4 Encryption

- Algorithm: AES-GCM, 256-bit key.
- Key derivation: PBKDF2 with minimum 310,000 iterations and a unique salt per user.
- Each encrypted record must use a unique IV. IVs must never be reused.
- Encrypted data format: IV prepended to ciphertext. Both stored together.
- Decryption failures must surface as explicit, user-actionable errors.

### 6.5 Security Rules

- No sensitive data in URL params, query strings, or browser history.
- No `console.log` of financial data or derived keys in any environment.
- Content Security Policy headers must be configured at the hosting level.
- All cryptographic operations must use the WebCrypto API exclusively.

---

## 7. PWA REQUIREMENTS

### 7.1 Manifest

- Full `manifest.json` with: name, short_name, description, icons (all required sizes), theme_color, background_color, display: standalone, start_url, scope.
- Icons must include maskable variants.

### 7.2 Service Worker (Workbox)

- Strategy: App shell precached on install.
- Versioned cache names. Old caches purged on activation.
- Navigation requests always served from cache (offline-first routing).
- Static assets: Cache-first strategy.
- No network-dependent features. All functionality must work from cache.

### 7.3 Update Flow

- Detect new service worker waiting.
- Display non-intrusive user prompt: "A new version of Zentro is available."
- User confirms before reload. Never force-refresh during active use.
- New version must not disrupt unsaved form state.

### 7.4 Local Notifications

Zentro uses the Notifications API and/or Scheduled Tasks (where available) for local-only alerts. No remote push server is involved.

**Notification types:**
- Budget threshold alert (default trigger: 80% utilization)
- Bill due reminder (3-day and 1-day advance)
- Savings goal reminder (weekly, if goal is behind target)
- Weekly financial summary (configurable day/time)

**Degradation rules:**
- If background APIs (Background Sync, Periodic Background Sync) are unavailable, evaluate notification triggers on app open.
- If Notifications API is denied or unavailable, surface alerts as in-app banners instead.
- Safari limitations must be handled silently — no error thrown, no broken state.

---

## 8. FEATURE REQUIREMENTS

### 8.1 Onboarding

A linear, 4-step onboarding flow triggered only for new users:

1. Create local account (email + password).
2. Add first account (type, name, opening balance).
3. Add first income transaction.
4. Set first monthly budget category.

Each step must be completable independently. Skipping is not permitted during initial setup. After completion, onboarding must never re-trigger.

---

### 8.2 Dashboard

The dashboard is the default authenticated landing page.

**Required widgets (in priority order):**
- Net worth summary (Total Assets − Total Liabilities)
- Monthly income vs. expenses (current month)
- Savings rate (current month)
- Budget utilization overview (top categories)
- Recent transactions (last 5–10)
- Upcoming bills (next 7 days)
- Quick action buttons (Add Transaction, Add Account)

All widgets must reflect real-time data from IndexedDB. No stale cache permitted for financial figures.

---

### 8.3 Transactions

**Transaction types:** Income, Expense, Transfer.

- Transfers are excluded from income/expense reports and budget calculations.
- Every transaction requires: date, amount, type, account, and category.
- Optional fields: notes, receipt image (stored as binary blob in IndexedDB).
- Single primary category per transaction. No split categories.
- Custom categories supported. System categories are non-deletable.

**Recurring transactions:**
- Configurable frequency: daily, weekly, biweekly, monthly, yearly.
- Auto-generate upcoming entries on app open (up to 90 days ahead).
- User can edit or delete individual instances without breaking the series.

**Bulk import:**
- CSV import with interactive column mapping UI.
- User maps CSV columns to Zentro fields before import.
- Validation step with error summary before committing.
- Duplicate detection based on date + amount + account combination.

**Autofill:**
- Suggest category and notes based on patterns from previous transactions.
- Triggered by payee/description input.
- Suggestions must be dismissible.

---

### 8.4 Accounts

**Account types:** Cash, Bank, Checking, Savings, Credit Card, Loan, Investment.

- Each account has: name, type, currency, opening balance, opening date.
- Credit card accounts additionally track: credit limit, minimum payment due, payment due date.
- Loan accounts track: outstanding principal, interest rate (display only).
- Investment accounts display current value only (no live price feeds).

**Net worth calculation:**
- Assets: Cash, Bank, Investment accounts (positive balances).
- Liabilities: Credit card outstanding balances, Loan outstanding balances.
- Net worth = Total Assets − Total Liabilities.

**Multi-currency:**
- Each account can have its own currency.
- Exchange rates are entered manually by the user.
- All dashboard figures are converted to a user-selected base currency.
- Exchange rate management available in Settings.

**Reconciliation:**
- User can mark an account as reconciled up to a specific date.
- Reconciled transactions are visually differentiated.
- Reconciliation does not lock or prevent edits — it is informational.

---

### 8.5 Budgeting

- Budgets are set per category per monthly cycle.
- Cycle start date is configurable (default: 1st of each month).
- Carry-forward toggle per category: if enabled, unspent amount rolls into next month.
- Default alert threshold: 80% of budget consumed (configurable globally and per category).
- Visual progress bar per category showing utilization.
- Budgets auto-reset each cycle. Historical budget data is preserved for reports.

---

### 8.6 Reports & Analytics

All reports are computed client-side from IndexedDB data.

**Required report views:**
- Monthly breakdown (income, expenses, savings by category)
- Yearly overview (monthly trend bars)
- Category distribution (donut/pie for expense categories)
- Income vs. expense trend (line chart, last 12 months)
- Net worth growth over time (area chart)
- Savings rate over time (line chart)

**Anomaly detection:**
- Flag transactions that deviate significantly from a 3-month rolling average for that category.
- Anomalies are surfaced as informational callouts — not hard blocks.
- Sensitivity is not user-configurable in v1.

**Performance requirement:**
- All report computations must complete within 500ms for datasets up to 50,000 transactions.
- Heavy computations must not block the main thread. Use Web Workers where necessary.
- Charts must render without jank on mid-range mobile devices.

---

### 8.7 Savings Goals

- Each goal has: name, target amount, target date, linked account(s), color/icon.
- Contributions are treated as real transfers from a source account to a virtual goal-linked account.
- Goal progress is calculated from actual contributions, not manual input.
- Multiple accounts can contribute to a single goal.
- Visual progress ring with projected completion date.
- Weekly reminder notification if goal is behind target pace.

---

### 8.8 Recurring Bills

- Bills are distinct from recurring transactions (they represent obligations, not actuals).
- Each bill: name, amount, due day of month, category, account to pay from.
- Calendar view showing all upcoming bills for the current and next month.
- Auto-generate pending bill entries on app open.
- User marks bills as paid — this creates an actual expense transaction.
- 3-day and 1-day advance notifications.

---

### 8.9 Export & Backup

**CSV Export:**
- Export all transactions or filtered subset.
- Columns: date, type, amount, currency, account, category, notes.

**Encrypted Backup (default):**
- Full IndexedDB snapshot encrypted with user's derived key.
- File format: `.zentro` (custom extension).
- Restore requires the user's password to decrypt.

**Plain JSON Export (advanced):**
- Unencrypted full data export.
- Must display explicit warning before proceeding: "This file contains all your financial data in plaintext. Store it securely."

**Import/Restore:**
- Full backup restore from `.zentro` file.
- Validates file integrity before committing.
- Must warn user that restore will overwrite existing data.

**Persistent notice in Export UI:**
> "Your data is stored locally on this device and does not sync automatically. Regular backups are strongly recommended."

---

### 8.10 Settings

| Setting | Description |
|---|---|
| Theme | Light / Dark / System |
| Date Format | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD |
| Base Currency | User's primary display currency |
| Budget Alert Threshold | Global default (percentage) |
| Category Management | Add, rename, reorder, delete custom categories |
| Exchange Rates | Manual entry per currency pair |
| Biometric Setup | Enroll or remove biometric credential |
| Inactivity Timeout | Configurable lock duration |
| Notification Preferences | Toggle and configure each notification type |
| Data & Backup | Export, import, delete account |

**Account deletion:** Permanently removes all data for that local profile. Requires password confirmation. Irreversible.

---

## 9. PERFORMANCE REQUIREMENTS

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s on mid-range mobile (cached) |
| Time to Interactive | < 2.5s on mid-range mobile (cached) |
| Report computation (50k tx) | < 500ms |
| Transaction list render (1000 items) | Virtualized — no full DOM render |
| IndexedDB read (single record) | < 10ms |
| Encryption/decryption per record | < 5ms |
| Service worker install | < 3s on broadband |
| Lighthouse PWA score | 100 |
| Lighthouse Performance score | ≥ 90 |
| Lighthouse Accessibility score | ≥ 95 |

- Transaction lists must use virtual scrolling (windowed rendering).
- Heavy computations (reports, anomaly detection) must run in Web Workers.
- IndexedDB queries must use indexes — no full table scans for filtered views.
- Images (receipts) must be stored as compressed blobs. Max size enforced: 2MB per image.

---

## 10. ACCESSIBILITY REQUIREMENTS

- WCAG 2.1 AA compliance minimum.
- All interactive elements must be keyboard accessible.
- Focus management must be correct on modal open/close.
- All form inputs must have associated labels.
- All charts must have accessible text alternatives (summary tables or ARIA descriptions).
- Color contrast ratio: minimum 4.5:1 for body text, 3:1 for large text.
- Touch targets: minimum 44×44px on mobile.
- Screen reader tested on: VoiceOver (iOS/macOS), TalkBack (Android).

---

## 11. BEST PRACTICES

### 11.1 Code Quality
- Feature-based folder structure. No file-type-based folders (no `/components`, `/hooks` at root).
- Each feature owns its components, hooks, types, and service calls.
- Shared primitives live in `/shared` or `/ui`.
- No component exceeds 300 lines. Extract sub-components aggressively.
- Custom hooks for all non-trivial stateful logic.
- No inline styles. All styling via Tailwind utility classes.
- All user-facing strings must be defined as constants — no hardcoded strings in JSX.

### 11.2 Testing Requirements
- Unit tests for: all service layer functions, all crypto operations, all data transformation utilities.
- Integration tests for: auth flow, transaction CRUD, budget calculations, CSV import.
- Component tests for: all form components, all critical UI interactions.
- Test framework: Vitest + React Testing Library.
- Minimum coverage: 80% on service and crypto layers.

### 11.3 Git & Commit Standards
- Conventional Commits format enforced (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Each commit must represent a single logical change.
- No committed secrets, keys, or environment-specific values.
- `.env` files are gitignored. A `.env.example` with placeholder values is committed.

### 11.4 Dependency Management
- Minimize third-party dependencies. Prefer Web Platform APIs.
- Every dependency must be actively maintained (last release < 12 months).
- No dependencies with known high/critical CVEs.
- Lock file (`pnpm-lock.yaml` or equivalent) committed and kept in sync.
- Prefer `pnpm` as package manager.

### 11.5 Build & Deployment
- Production build must have: tree-shaking, code splitting, asset fingerprinting.
- Bundle size target: < 300KB gzipped initial JS payload.
- All routes code-split. No feature module bundled into the initial chunk.
- Source maps generated but not deployed publicly.
- CI pipeline: lint → type-check → test → build → deploy.

### 11.6 Secrets & Environment
- No API keys exist in this project (by design).
- `VITE_APP_VERSION` is the only environment variable needed.
- Build version injected at compile time for cache-busting and update detection.

---

## 12. FOLDER STRUCTURE (REFERENCE)

```
zentro/
├── public/
│   ├── manifest.json
│   ├── icons/
│   └── sw.js (generated by Workbox)
├── src/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── accounts/
│   │   ├── budgets/
│   │   ├── reports/
│   │   ├── goals/
│   │   ├── bills/
│   │   ├── settings/
│   │   └── onboarding/
│   ├── shared/
│   │   ├── ui/          ← shadcn/ui primitives
│   │   ├── hooks/       ← global shared hooks
│   │   ├── types/       ← global TypeScript types
│   │   ├── constants/   ← app-wide constants
│   │   └── utils/       ← pure utility functions
│   ├── services/
│   │   ├── crypto/      ← WebCrypto operations
│   │   ├── storage/     ← IndexedDB abstraction
│   │   ├── auth/        ← session, KDF, WebAuthn
│   │   └── notifications/
│   ├── workers/         ← Web Worker scripts
│   ├── app/
│   │   ├── router.tsx
│   │   ├── providers.tsx
│   │   └── App.tsx
│   └── main.tsx
├── tests/
├── .env.example
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── INSTRUCTIONS.md
```

---

## 13. NON-GOALS (EXPLICIT EXCLUSIONS)

These are permanently out of scope and must never be introduced:

- Cross-device sync of any kind
- Bank or financial institution API integrations
- Live exchange rate feeds
- Cloud storage or backup
- Any backend service, serverless function, or edge worker
- Remote push notification infrastructure
- Machine learning model hosting
- Multi-currency automatic conversion via live APIs
- Social or sharing features
- Export to accounting software formats (QuickBooks, Xero, etc.) — v1 only

---

## 14. DEFINITION OF DONE

A feature is considered complete when:

- [ ] All requirements in this document for that feature are implemented
- [ ] TypeScript strict mode passes with zero errors
- [ ] ESLint passes with zero warnings
- [ ] Unit and integration tests written and passing
- [ ] Works fully offline (verified with DevTools → Network → Offline)
- [ ] Accessible via keyboard navigation
- [ ] Renders correctly on mobile (375px), tablet (768px), and desktop (1440px)
- [ ] No plaintext financial data observable in IndexedDB (verified in DevTools)
- [ ] Lighthouse PWA score: 100
- [ ] Performance budget not exceeded

---

*Last updated: March 2026 — Arctic Zinc theme confirmed. Stack locked.*