# ADR 0001: Manual degraded-mode kill switch for SHSG-backed features

## Status
Accepted

## Context
Every year during intro week, a spike in Biddit usage overloads the SHSG
backend (`api.shsg.ch`), which serves study plans/wishlist, course ratings,
curriculum plans, and the similar-courses vector DB. The university API
(`integration.unisg.ch`), which serves course data, calendar, and heatmap,
handles the load fine — it's a separate service with separate capacity.

When `api.shsg.ch` falls over, the current behavior is uncontrolled: requests
time out, retry (see `MAX_RETRIES` in `axiosClient.js`), and eventually
surface as toasts prompting users to email a bug report, adding load and
noise on top of an already-degraded backend. We need a way to proactively
shed load from `api.shsg.ch` — disabling the features that depend on it —
while keeping course browsing, calendar, heatmap, and grade transcript (which
only need `integration.unisg.ch`) fully usable. The mechanism must be
operable by a non-engineer on-call during an incident, without needing a code
change beyond a single well-understood config edit.

## Options considered

1. **Static status file polled by the client (chosen).** A JSON file
   (`app/public/app-status.json`) on the Netlify CDN carries a manually-edited
   `degradedMode` boolean. The client polls it periodically and gates SHSG
   traffic accordingly. Simple, no backend involved, fail-open by
   construction (see Decision).
2. **Circuit breaker (automatic, response-driven).** Trip degraded mode
   automatically based on observed error rates/latency from `api.shsg.ch`.
   Rejected: significantly more complexity (state machine, thresholds,
   half-open probing) for a predictable, calendar-driven event (intro week),
   and real risk of flapping — a brief blip mid-spike would toggle the UI
   back and forth, which is worse for users than a stable manual switch. A
   circuit breaker remains a reasonable follow-up if SHSG instability turns
   out to be less predictable than intro-week spikes.
3. **Session-local degraded mode for the wishlist** (keep wishlist edits
   working locally, sync later). Rejected: wishlist mutations during a
   session that never syncs back to `api.shsg.ch` risk silent data loss if
   the session ends (tab closed, token expiry) before the sync happens. Full
   read-only disablement of wishlist-editing features is safer and simpler
   to reason about than a local-write-then-reconcile path.

## Decision
Implement a manual, static kill switch:

- **Source of truth**: `app/public/app-status.json`, served from the Netlify
  CDN with `Cache-Control: public, max-age=60, must-revalidate`
  (`app/public/_headers`). Fields: `schemaVersion`, `degradedMode` (boolean),
  `message` (string or null), `updatedAt`.
- **Client poller**: `degradedModeService.js`
  (`app/src/components/helpers/degradedModeService.js`) fetches the status
  file on load and then every 5 minutes ± 30s of jitter (`intervalMs: 300000`
  default, jitter via `Math.random() * 60000 - 30000`), using a plain
  `fetch` (not `apiClient`, to avoid a circular import and because the file
  needs no auth). **Fail-open**: any fetch error, non-OK response, bad JSON,
  or non-boolean `degradedMode` leaves the current in-memory state untouched
  — a broken status endpoint can never itself put the app into degraded
  mode, only an explicit, valid `degradedMode: true` in the document can.
- **Enforcement point**: the axios request interceptor in `axiosClient.js`
  rejects any request whose host is `api.shsg.ch` while degraded mode is
  active, throwing a `DegradedModeError` (`code: "DEGRADED_MODE"`) **before
  any network I/O** — no retries, no toast. This is the single safety net:
  even if a new SHSG-backed feature forgets to add its own UI gate, its
  requests still get rejected client-side instead of hitting the
  already-stressed backend.
- **Error classification**: `ErrorHandlingService.jsx` classifies
  `DEGRADED_MODE` as recoverable with `shouldShowToast: false`, so it never
  produces a report-email prompt (see
  `app/src/components/errorHandling/ERROR_HANDLING.md`, §4a, for the full
  error-flow detail — not duplicated here).
- **Hooks stay passive while degraded**: SHSG-backed hooks
  (`useStudyPlanDataSimplified.js`, `useCourseRatingsData.js`) fast-path their
  loading state without writing to Recoil state while `isDegradedMode` is
  true, which preserves `lastFetched` semantics — when degraded mode clears,
  the existing fetch-if-stale logic picks the data back up automatically, no
  extra "recovery" code path needed.
- **UI**: a global, non-blocking `DegradedModeBanner` (wired into
  `AppStateProvider`) plus a shared `DegradedPlaceholder` component gating 8
  SHSG-backed surfaces: `LockOpen` (wishlist lock), `StudyOverview`,
  `CurriculumMap`, `SmartSearch`, `SimilarCourses`, `CourseInfo` (ratings),
  `ReviewButton`, and `GradeTranscript` (custom grades only — university
  transcript data keeps working).
- Rejected alternatives: automatic circuit breaker (flap risk, unneeded
  complexity for a predictable event) and session-local wishlist writes
  (silent-data-loss risk) — see Options above.

## Consequences

**Positive**
- Zero-backend-change kill switch: flipping it is a one-line JSON edit and a
  static-asset deploy, nothing SHSG-side has to change.
- Fail-open by default: any failure mode in the status-fetch path (network,
  CDN, malformed JSON) leaves the app in normal mode, never accidentally
  degraded.
- The interceptor is a hard backstop — UI gates can lag a new SHSG endpoint
  without the backend actually taking traffic.
- Automatic recovery: no explicit "un-degrade" data-refresh logic was needed
  because the hooks never wrote stale/placeholder data into Recoil state.

**Negative / accepted trade-offs**
- **Propagation latency**: up to ~7 minutes end-to-end in the worst case (60s
  CDN `max-age` + up to 5m30s until the next poll tick fires client-side) for
  a tab that's already open. New page loads pick it up on the first fetch.
- **Toggling requires a commit + deploy**, not an instant admin-panel flip.
  This is deliberate (see Ops runbook below for why that's an asset, not a
  liability, for rollback).
- **Maintenance burden**: every future SHSG-backed feature must remember to
  add its own `DegradedPlaceholder` gate for a good UX; forgetting one is a
  UX gap (an unexplained empty/loading state), not a backend-load risk,
  because the interceptor still blocks the underlying request.
- **No automatic re-enable**: if the spike passes and nobody flips the flag
  back, the app stays degraded indefinitely — this is intentional (avoids
  flapping) but requires an operator to remember to disable it.

## Ops runbook

**Enable degraded mode:**
1. Edit `app/public/app-status.json`, set `"degradedMode": true`. Optionally
   set `"message"` to a short user-facing string (shown in the banner /
   placeholders); update `"updatedAt"`.
2. Commit **that file alone** on the deploy branch (see "why solo commit"
   below) and push.
3. Netlify builds and deploys automatically — typically ~1-2 minutes.
4. Verify the live file: `curl https://<prod-domain>/app-status.json` and
   confirm `"degradedMode": true` in the response.
5. Already-open tabs pick up the change within ~7 minutes (CDN cache +
   client poll interval, see Consequences above); new page loads pick it up
   immediately.

**Disable degraded mode:**
1. Same file, set `"degradedMode": false` (and clear/update `"message"`).
2. Commit alone, push, verify via the same `curl`, same propagation window.

**Why commit `app-status.json` alone:** keeping the toggle as an isolated,
single-file commit means disabling it (or backing out a bad message) is a
plain `git revert <sha>` with no risk of reverting unrelated code that may
have shipped since. Do not bundle the toggle into a larger commit.

**If something looks wrong:** confirm the interceptor is actually rejecting
`api.shsg.ch` calls (browser devtools network tab — SHSG requests should show
as cancelled/rejected client-side, not sent) and that
`degradedModeService.js`'s poll succeeded (no `console.warn` from
`degradedModeService: failed to fetch/parse app-status.json` in the console).
If the poll is failing, the service fails open — the app stays in normal
mode, which is the safe default while you investigate.
