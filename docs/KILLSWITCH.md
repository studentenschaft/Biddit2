# Kill Switch: Degraded Mode

A one-file toggle that shuts off traffic to the SHSG backend (`api.shsg.ch`)
when it's overloaded (e.g. intro week), without a backend deploy. This
document is the operator runbook — for the design rationale, see
[`docs/adr/0001-degraded-mode-kill-switch.md`](adr/0001-degraded-mode-kill-switch.md).

## What it does

Flipping the switch disables everything that talks to `api.shsg.ch`:

- Wishlist / study plans
- Course ratings
- Curriculum map
- Smart search / similar courses
- Custom grades

**Stays up** (all served by the University API, `integration.unisg.ch`,
which is a separate service and unaffected):

- Course browsing and search
- Calendar
- Grade transcript (official university data — only *custom* grades are
  gated)

Users see a non-blocking banner explaining features are temporarily reduced.

## How to enable

1. Edit `app/public/app-status.json`:
   ```json
   {
     "schemaVersion": 1,
     "degradedMode": true,
     "message": "Optional custom text shown in the banner",
     "updatedAt": "2026-08-04T12:00:00Z"
   }
   ```
   `message` is optional — omit or leave `null` to show the default banner
   copy.
2. Commit **this file alone** — no other changes in the same commit (see
   Rollback below for why) — on whichever branch your Netlify site builds
   from, and push.
3. Netlify builds and deploys automatically, ~1-2 minutes.

## Verification

Confirm the live file:

```bash
curl https://<prod-domain>/app-status.json
```

Check `"degradedMode": true` in the response.

Already-open tabs pick this up automatically within **~6-7 minutes** (60s
CDN cache + a 5 min ± 30s client poll interval) — **no user reload needed**.
New page loads pick it up immediately.

## How to disable

Same flow: set `"degradedMode": false` (clear or update `"message"`), commit
alone, push, verify with the same `curl`. Recovery is automatic — no other
steps required. Features refetch their data within one poll cycle once the
client sees the flag flip back to `false`.

## Rollback

Because the toggle is always its own isolated commit, backing it out (a bad
message, or re-enabling too hastily) is a plain:

```bash
git revert <sha-of-the-toggle-commit>
```

with no risk of reverting unrelated code shipped since.

## Troubleshooting

**Banner isn't appearing after deploy:**
- Re-run the `curl` above — confirm the deployed file actually has
  `"degradedMode": true`. A stale CDN cache or a deploy that didn't pick up
  the commit are the usual culprits.
- Open the browser console and look for `degradedModeService: failed to
  fetch/parse app-status.json` warnings. If the poll is failing, the system
  **fails open** — see below.

**Fail-open semantics:** if `app-status.json` is missing, unreachable,
malformed, or has a non-boolean `degradedMode`, the client leaves its
current state untouched — a broken status endpoint can only leave the app in
**normal mode**, never accidentally trigger degraded mode. So "nothing
happened" after a bad edit means normal mode, not an outage.
