# ADR 0004: Analytics consent opt-out layer

- **Status:** Accepted
- **Date:** 2026-08-14
- **Supersedes / relates to:** ADR 0003 (GA4 analytics adapter)

## Context

Biddit sends GA4 events from the production host through a single adapter
(`app/src/components/helpers/analytics.js`, see ADR 0003). Swiss law does not
require prior consent for this kind of analytics, but Art. 45c lit. b TCA
(Telecommunications Act) does require that visitors are informed about the
processing and are given the possibility to refuse it. The FDPIC reads this
as an *opt-out* obligation: analytics may run by default, but the user must
be able to switch it off, and the choice must take effect.

Today there is no way for a visitor to refuse. We need one, and it has to
work for the whole page load — a setting that only applies after a manual
reload is not a real refusal, and users will not reload.

## Options considered

1. **A consent-management platform (CMP) library** (Cookiebot, Osano, klaro…).
   Full TCF/GDPR machinery, a third-party script, cookie scanning, and a
   recurring cost. Massively oversized for one analytics property with no
   ads, no personalisation, and no third-party tags, and it drags another
   external script into a bundle we deliberately keep small.

2. **A blocking opt-in banner** (no analytics until the user accepts).
   Stricter than Swiss law requires for this processing, harms the very first
   interaction of every session, and would destroy the usefulness of the data
   we collect (landing view, session-start tab) since most users dismiss.

3. **An opt-out layer inside the existing analytics adapter** (chosen).
   Consent becomes one more gate in the module we already own, persisted in
   `localStorage`, exposed to the UI through three exports.

## Decision

Extend the analytics adapter with a consent layer. No new dependency, no new
GA call site — the single-adapter rule from ADR 0003 still holds.

- `ANALYTICS_OPT_OUT_STORAGE_KEY = "biddit-analytics-opt-out"`, stored in
  `localStorage` (device-local, survives reloads, needs no backend and no
  account — the choice is not personal data we want to sync).
- `isAnalyticsOptedOut()` reads that key. Safe to call before `initAnalytics`,
  so UI can render the current state at any time.
- `setAnalyticsOptOut(optedOut)` persists the choice **and applies it
  immediately, in both directions, without a reload**:
  - **Opting out** sets the per-event gate `enabled = false` and, for a tag
    that is already loaded, sets Google's documented per-hit kill switch
    `window["ga-disable-G-BMG2V9ZX73"] = true`. Two independent barriers: the
    adapter stops emitting, and gtag itself stops sending.
  - **Opting back in** clears the key, clears the window flag and — if
    `initAnalytics` already ran while the visitor was opted out, so the tag
    was never loaded — loads it now via the internal `loadGa()`.
- Two module flags support this: `environmentEnabled` remembers the
  environment-gate result on its own (so a later opt-in can only re-enable
  where analytics was allowed in the first place), and `gaLoaded` guards
  `ReactGA.initialize` against a double load on a late opt-in.
- At init, `enabled = environmentEnabled && !isAnalyticsOptedOut()`. Opt-out
  wins even over the `enabled: true` test override, which is what makes the
  behaviour testable in jsdom.

## Consequences

- The choice takes effect instantly, both ways, on the same page load. No
  reload, no "your change applies next visit" caveat in the UI.
- An opted-out visitor whose choice was stored **before** init never causes
  `ReactGA.initialize` to run: the gtag script is not fetched at all and no
  GA cookies are set.
- A visitor who opts out **during** a session keeps the already-loaded gtag
  script in the page. Nothing further is sent (adapter gate plus `ga-disable`),
  but the script and any cookies it already set stay until the page is left.
  Removing them would require a reload, which we judged worse for the user
  than a silent, inert script.
- The setting is per device and per browser profile, and is lost when site
  data is cleared. Acceptable: the fallback state is the lawful default
  (analytics on, refusable at any time), not a silent re-enable of something
  the user forbade on that device.
- The UI surface (settings toggle, privacy-notice link) is built on the three
  exports above and carries no GA knowledge of its own.
