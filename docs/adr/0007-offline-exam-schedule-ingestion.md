# ADR 0007: Exam schedules are ingested offline into a per-semester JSON file

- **Status:** Accepted
- **Date:** 2026-08-27

## Context

Biddit shows what an exam *is* (`examinationParts`: type, weighting) but not
when it happens. HSG publishes the central exam dates only as a per-semester
PDF — `docs/exams/Prüfungsplan OT Winter 2027.pdf` covers the HS26 exam period,
18.01.–20.02.2027. The PDF itself tells students that avoiding exam collisions
while bidding is their own responsibility and that no exceptions are granted,
which is exactly the check a bidding tool should be doing for them.

This ADR covers Phase 0 only: getting the dates into the repository as
trustworthy data. Nothing in the app reads the artifact yet.

## Options considered

1. **Parse the PDF in the browser with pdf.js.** Rejected. It ships a parser
   plus a font stack to every user to re-derive, on every page load, data that
   changes twice a year. Any layout surprise would then be a runtime failure in
   front of a student instead of a build-time failure in front of us.

2. **Read the dates from the UniSG API.** Rejected because there is no such
   endpoint: `EventApi` exposes examination *forms* and weightings, not the
   central schedule. There is nothing to call.

3. **Maintain the JSON by hand.** Rejected. 178 written entries across 15 dates
   with a 09:15/15:15 split; a typo in the slot is a six-hour error that nothing
   would catch. Transcription is exactly the work a parser should do.

4. **Put the script in a repo-root `scripts/`.** Rejected: the repo root has no
   `package.json`, so root scripts get neither lint nor test coverage.
   `app/scripts/` inherits both, and `app/scripts/` is never bundled — Vite only
   walks the import graph from `src/`.

5. **Import `getCourseRootKey` and friends from `app/src`.** Rejected as the
   wrong dependency direction: a Node CLI would start depending on browser
   application code. The CLI owns a three-line `courseNumberToRoot`. Lifting the
   shared helper into `courseUtils.js` is Phase 1 work, when a runtime consumer
   actually exists.

## Decision

An offline, deterministic parser (`app/scripts/ingest-exam-plan/`) turns
`pdftotext -layout` output into `app/public/exams/<SEMESTER>.json`, run by hand
once per semester. `cli.js` is the only file that touches the filesystem, the
process or a child process; parsing, building, validating and reporting are pure
functions with unit tests.

**The semester key is always passed explicitly.** "Winter 2027" is the exam
period of HS26 — a calendar fact about the academic year, not something in the
PDF. Inferring it would be guessing.

**Validation gates the write.** The JSON is written only when there are zero
errors. Two of the checks exist specifically to make silent data loss
impossible:

- `E_COUNT_MISMATCH` re-counts the exam rows in the raw text and compares
  against the built plan, so a dropped row fails the run.
- `E_UNCONSUMED_LINE` checks the residue of every table row. A title always runs
  from its own entry match to the next one, so a row is covered contiguously
  from its first match onwards; whatever sits to the left must be a date, a
  weekday or a table header. A row shape the parser does not understand becomes
  a line-numbered error instead of a missing exam.

**The 09:15/15:15 boundary is read from each page's own header line** (the
column of the second `Prüfungsbeginn`), because it moves between pages —
151, 119 and 123 in this PDF. A page from which no boundary can be derived is
fatal rather than guessed: a wrong boundary shifts exams by six hours silently.

**UTC offsets are computed, not hardcoded**, via `Intl` probed at 12:00 UTC, so
a summer plan comes out as CEST.

**A golden fixture is committed** — the exact `pdftotext` output alongside the
blessed artifact. The golden test also compares the shipped
`public/exams/HS26.json` against a fresh build, so the published file cannot
drift away from the parser.

The optional `--catalog` cross-check is advisory and never fails the build. Its
snapshot lives in `docs/exams/catalog-*.json`, which is gitignored: it is copied
out of DevTools and must never be committed.

## Consequences

- **Freshness is manual.** Someone must re-run the pipeline when a new plan is
  published; there is no automation and no alert. The runbook lives in
  `app/scripts/ingest-exam-plan/README.md`.
- **`byod` is a lower bound.** The digital-exam marker is a shading glyph that
  `pdftotext` cannot see, so only titles that spell out `(BYOD)` are flagged.
  Consumers may say "this is BYOD" but never "this is not".
- **The AT plan is incomplete** until the alternative-date schedule is published
  in CW42; every run prints `W_AT_INCOMPLETE`. Phase 1 should default to `OT`.
- **Oral exams have no start time.** They carry `startIso: null` and
  `timesPublishedLater: true`; individual slots appear in Compass later.
- **poppler is a developer prerequisite**, not a runtime or CI one. The test
  suite runs off the committed extraction, so `npm test` never needs it.
- `schemaVersion` is stamped into the artifact so a Phase-1 runtime consumer can
  refuse a shape it does not understand.
