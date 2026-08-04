# Error Handling & Session Resilience

This document describes how Biddit handles API errors, network loss, and session
problems. The goal is to **recover automatically where possible** and **only ask
the user to report an error when it is a genuine, non-recoverable bug** — so the
team stops receiving error-report emails for offline blips and stale sessions.

## Overview

```
                         ┌──────────────────────────┐
   component ──get/post──▶        apiClient          │  src/components/helpers/axiosClient.js
                         │  (axios + interceptors)   │
                         └────────────┬─────────────┘
                                      │ on error
                          ┌───────────▼────────────┐
                          │  classify & route       │
                          └───┬───────┬───────┬─────┘
            offline / network │  401  │ 5xx / timeout │ other 4xx (404, 403…)
                              │       │               │
                  emit OFFLINE│  token refresh        │  errorHandlingService
                              │  (tokenService)       │  .handleError → classify
                              ▼       ▼               ▼
                     ┌────────────────────────────────────────┐
                     │  AppStateProvider (event listeners)     │  src/components/common/
                     │  renders ONE blocking modal:            │
                     │   expired > renew > offline             │
                     └───┬──────────┬───────────┬──────────────┘
                         ▼          ▼           ▼
                  OfflineModal  SessionRenew  SessionExpired   (toast only for real bugs)
```

Two independent event channels feed the UI:

| Channel | Emitter | Events | Consumer |
| --- | --- | --- | --- |
| Network | `axiosClient.js` (`addNetworkEventListener`) | `OFFLINE` | `AppStateProvider` |
| Session | `tokenService.js` (`addSessionEventListener`) | `SESSION_RENEW`, `SESSION_EXPIRED` | `AppStateProvider` |

`AppStateProvider` also listens to the browser's native `window` `online`/`offline`
events as a second offline signal.

## 1. Request flow (`axiosClient.js`)

Every request goes through a singleton `ApiClient` with request/response
interceptors.

**Request interceptor**
- If `navigator.onLine === false`, emit `OFFLINE` and reject immediately (no
  request is sent).
- Otherwise inject the SHSG headers + bearer token and initialise `_retryCount`.

**Response interceptor** (on error), in order:
1. **Offline** (`navigator.onLine === false`) → emit `OFFLINE`, reject. No toast.
2. **401 Unauthorized** → `handle401Error()` (token refresh + request queuing).
3. **Retryable transient error** (`ERR_NETWORK`, timeout, or 5xx) and
   `_retryCount < MAX_RETRIES` → `retryWithBackoff()`.
4. **Otherwise** mark the error and decide:
   - `ERR_NETWORK` (after retries) → emit `OFFLINE`. **Never a toast/email** —
     `navigator.onLine` can be `true` behind a captive portal or when the server
     is unreachable, so we surface the offline modal here regardless.
   - anything else → `errorHandlingService.handleError(error)` (which classifies
     and decides whether to toast — see §4).

**Retry with backoff** — exponential delay with jitter (`MAX_RETRIES = 3`):
`1–1.5s → 2–3s → 4–6s`. Re-checks connectivity before each retry.

**401 handling & request queuing** (`handle401Error`)
- Marks the request `_retry` so it is only refreshed once.
- If a refresh is already in flight, the request is **queued** and resumed with
  the new token (prevents N concurrent 401s from triggering N refreshes).
- Calls `getRefreshToken()`:
  - **token returned** → retry the original (and all queued) requests.
  - **null** → reject. `tokenService` has already emitted the correct session
    event; `axiosClient` does not emit session events itself.

## 2. Token refresh & session events (`tokenService.js`)

`getRefreshToken()` is the **single source of truth** for session events. It always
emits exactly one event when it returns `null`, so callers just react to `null`.

| Situation | Event | Meaning |
| --- | --- | --- |
| Silent acquisition succeeds | _(none)_ | token returned, counters reset |
| No MSAL account present | `SESSION_EXPIRED` | session genuinely gone |
| `InteractionRequiredAuthError` | `SESSION_EXPIRED` | re-login required |
| `BrowserAuthError` → popup recovers | _(none)_ | token returned |
| `BrowserAuthError` → popup fails transiently | `SESSION_RENEW` | refresh likely fixes it |
| `BrowserAuthError` → popup `InteractionRequired` | `SESSION_RENEW`/`SESSION_EXPIRED`¹ | escalates after repeats |
| Unexpected error | `SESSION_RENEW`/`SESSION_EXPIRED`¹ | escalates after repeats |

¹ A `sessionDeathCount` escalates to `SESSION_EXPIRED` once genuine failures reach
`MAX_SESSION_FAILURES` (3); before that we prefer the less disruptive `SESSION_RENEW`.

**Why two events?** A `BrowserAuthError` (e.g. `monitor_window_timeout`) usually
means the in-iframe silent refresh timed out while the session is *still valid*. A
full page reload re-initialises MSAL and typically recovers it **without forcing a
re-login**. So those become `SESSION_RENEW` (prompt a refresh) rather than
`SESSION_EXPIRED` (force login).

> Note: `acquireTokenPopup` is launched from a background interceptor (no user
> gesture) and is therefore usually blocked by the browser — it rarely recovers
> silently and falls through to the refresh prompt. That is expected.

Other exports: `handleAuthFailure` (log-only; events are owned by
`getRefreshToken`), `clearSessionAndRedirect` (clears MSAL storage and redirects to
`/login`), `resetSessionState` (tests).

## 3. Modals (`AppStateProvider` + `src/components/common`)

`AppStateProvider` wraps the app (mounted in `App.jsx`), tracks `isOffline`,
`isSessionRenew`, `isSessionExpired`, and renders **at most one** blocking modal
with precedence **expired > renew > offline**.

| Modal | Trigger | UX |
| --- | --- | --- |
| `OfflineModal` | `OFFLINE` (axios or `window`) | "You appear to be offline" + **Try again**. No email path. |
| `SessionRenewModal` | `SESSION_RENEW` | **Step 1:** prompt **Refresh page** (F5). **Step 2** (recurs after refresh): **Log out & back in** + a last-resort **report** link. |
| `SessionExpiredModal` | `SESSION_EXPIRED` | 3s countdown → `clearSessionAndRedirect()` to `/login`. |

`SessionRenewModal` distinguishes step 1 vs step 2 with a `sessionStorage` marker
(`biddit.sessionRenewAttemptedAt`) that survives the page reload; the marker is
treated as "recent" for 2 minutes so an unrelated later failure starts fresh.

## 4. Error classification & toasts (`ErrorHandlingService.jsx`)

`classifyError(error)` returns `{ type, isRecoverable, shouldShowToast }`:

| Type | Match | `shouldShowToast` | Handled by |
| --- | --- | --- | --- |
| `NETWORK` | `ERR_NETWORK` | `false` | OfflineModal |
| `DEGRADED_MODE` | `code === "DEGRADED_MODE"` / `isDegradedModeError` | `false` | DegradedModeBanner / DegradedPlaceholder |
| `MSAL` | `BrowserAuthError` / `InteractionRequired` / monitor_window_timeout / popup errors | `false` | Session modals |
| `TIMEOUT` | `ECONNABORTED` / "timeout" | only after max retries | toast (real failure) |
| `AUTH` | 401 | `false` | token refresh / session modals |
| `SERVER` | 5xx | only after max retries | toast (real failure) |
| `CLIENT` | other 4xx (incl. **404**, 403) | `true` | toast |
| `UNKNOWN` | anything else | `true` | toast |

The toast (`ErrorToast` + `SendErrorButton`) is the **only** path that prompts the
user to email `biddit@shsg.ch`. By keeping `shouldShowToast: false` for network,
MSAL, and auth errors, those never generate report emails.

> **Scope note:** generic `404`s are still classified as `CLIENT` → toast. Some
> endpoints (SmartSearch "no similar courses", ratings) use 404 as normal control
> flow; silencing those is intentionally **out of scope** for this change.

## 4a. Degraded mode (manual SHSG kill switch)

A manually-toggled "degraded mode" flag lets us disable all `api.shsg.ch`
traffic client-side during a demand spike, without a deploy. The University
API (`integration.unisg.ch`) is never affected.

- **Source of truth**: `public/app-status.json`, a static file served from the
  Netlify CDN (`public/_headers` sets a short `Cache-Control`). Toggling it is
  a manual edit + deploy of that one file.
- **`degradedModeService.js`** (`helpers/`) polls `/app-status.json` via a
  plain `fetch` (not `apiClient` — avoids a circular dependency and needs no
  auth) on an interval with jitter, and exposes the current flag
  synchronously via `getDegradedMode()`. It is **fail-open**: any fetch
  error, non-OK response, bad JSON, or non-boolean `degradedMode` leaves the
  state unchanged, so a broken/never-succeeding status endpoint means normal
  mode forever.
- **Request-interceptor short-circuit** (`axiosClient.js`): if
  `isShsgHost(config.url)` and `getDegradedMode().isDegradedMode`, the
  request is rejected with a `DegradedModeError` **before any network I/O**
  — no request is sent, so it never enters the retry logic or the response
  interceptor.
- **`DEGRADED_MODE` error type** (`ErrorHandlingService.jsx`): a rejection
  carrying `code === "DEGRADED_MODE"` (or `isDegradedModeError`) classifies
  as `DEGRADED_MODE`, recoverable, `shouldShowToast: false` — it **never**
  produces a report-email toast.
- **UI**: `useDegradedMode()` (`common/`) subscribes to the service;
  `DegradedModeBanner` and `DegradedPlaceholder` (`common/`) consume it to
  show a non-blocking banner and per-feature placeholders respectively.

## 5. Configuration knobs

| Constant | File | Value |
| --- | --- | --- |
| `MAX_RETRIES` | `axiosClient.js` | `3` |
| `INITIAL_RETRY_DELAY` | `axiosClient.js` | `1000ms` |
| `REQUEST_TIMEOUT` | `axiosClient.js` | `10000ms` |
| `MAX_SESSION_FAILURES` | `tokenService.js` | `3` |
| `RECURRENCE_WINDOW_MS` | `SessionRenewModal.jsx` | `120000ms` |
| MSAL iframe/window timeouts | `authConfig.js` | raised to fight `monitor_window_timeout` |

## 6. Tests

Run with `npx vitest run` (Vitest + Testing Library + MSW).

- `helpers/__tests__/axiosClient.test.js` — 401 refresh/queueing, retries,
  classification, network error → `OFFLINE` (no toast).
- `auth/__tests__/tokenService.test.js` — session event model per failure cause.
- `common/__tests__/OfflineModal.test.jsx` — render + Try again.
- `common/__tests__/SessionRenewModal.test.jsx` — refresh-first, recurrence escalation.
- `common/__tests__/AppStateProvider.test.jsx` — event → modal wiring + precedence.

MSW mocks live in `src/test/mocks/` and support per-test error simulation via
`setErrorMode(ErrorSimulation.*, endpointPattern?)`.

## Manual verification

- **Offline:** DevTools → Network → *Offline* → trigger a request → offline modal,
  no error toast.
- **Transient session:** simulate a `monitor_window_timeout` (or a refresh failure)
  → "Refresh your session" modal → **Refresh page**; if it recurs, the log-out /
  report escalation appears.
- **Expired session:** clear MSAL accounts → `SESSION_EXPIRED` → countdown →
  redirect to `/login`.
