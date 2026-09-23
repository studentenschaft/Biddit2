# ADR 0010: Exam schedules are ingested offline into a per-semester JSON file

- **Status:** Accepted
- **Date:** 2026-08-27, revised 2026-09-23

## Context

Biddit shows what an exam *is* (`examinationParts`: type, weighting) but not
when it happens. HSG publishes the central exam dates only as a per-semester
PDF — `docs/exams/Prüfungsplan OT Winter 2027.pdf` covers the HS26 exam period,
18.01.–20.02.2027 — and no API exposes them. The PDF tells students that
avoiding exam clashes while bidding is their own responsibility, which is the
check a bidding tool should do for them. A wrong date is worse than none: a
misread start time is a six-hour error, and a dropped row is a clash nobody
sees.

## Decision

**Offline, by hand, once per published plan.** `npm run ingest:exams`
(`app/scripts/ingest-exam-plan/`) turns the PDF into
`app/public/exams/<SEMESTER>.json`. Nothing parses the PDF in the browser and
nothing is transcribed by hand. The CLI does all I/O; parsing, building and
validating are pure functions under the app's lint and tests, and Vite never
bundles them.

**Everything is read from the PDF, nothing is guessed.**

- The semester comes from the title, which names the exam period: "Winter
  2027" is HS26.
- Each exam takes the start time of the nearest label in its page's own table
  header, and a header or an exam that does not fit that layout is fatal.
- BYOD comes from cells shaded in the colour of the legend swatch
  "= digitale Prüfungen (BYOD)", or from "(BYOD)" in a title; without the
  legend's exact words nothing counts as shaded and the report warns
  `W_BYOD_LEGEND_MISSING`.
- UTC offsets are computed per date for Europe/Zurich, so a summer plan comes
  out in CEST.

**Errors block the write.** Anything the parser cannot place throws, and the
validator re-derives what it can from the raw text — above all the number of
exam rows, so a row the parser missed cannot vanish. One error and nothing is
written; `--dry-run` reports without writing.

**A re-ingest cannot shrink the plan unnoticed.** A write that would drop an
exam of the existing artifact is refused without `--allow-removals`; see
"Re-ingesting a revised plan" in the runbook.

**Schema version 2** carries oral exams as date ranges, since the oral page
prints no times; the app refuses any other version (ADR 0011).

**AT rows are kept, but they are not this semester's.** The 48 AT rows of the
Winter 2027 PDF are dated inside the OT period and mostly carry spring roots:
they are the alternative dates of Summer 2026 courses. HS26's own AT plan
(08.–20.02.2027) is announced for CW42, which the report flags as
`W_AT_INCOMPLETE`. The artifact keeps what the PDF prints, tagged by
`termType`; the app reads OT rows only.

**A golden file pins the output.** The exact `pdftotext -layout` text and the
shading the CLI read are committed as fixtures. The golden test rebuilds the
plan from them and compares it byte for byte with `public/exams/HS26.json`, so
the suite never needs poppler and the shipped file cannot drift from the
parser.

The optional `--catalog` cross-check is advisory and never fails a run. Its
snapshot, `docs/exams/catalog-*.json`, comes from DevTools and is gitignored. A
malformed snapshot may crash the CLI: it is a developer's own input.

## Consequences

- **Freshness is manual.** Someone must re-run the pipeline when HSG publishes
  a plan; nothing alerts. Runbook: `app/scripts/ingest-exam-plan/README.md`.
- **A new layout fails loudly.** New start times work as long as the header
  labels them; a new column arrangement or row shape is an error to fix in the
  parser, not a silently wrong plan. BYOD is the exception: a reworded legend
  only warns, and shading that is dropped or recoloured while the legend
  stays writes silently with fewer exams marked. Only comparing the dry run's
  BYOD count with the PDF (runbook step 2) catches that.
- **poppler is a developer prerequisite** for `--pdf` only. The tests and CI
  run off the committed fixtures.
- **Semesters accumulate.** Each one adds its PDF, artifact, two fixtures and a
  golden case, and replaces nothing of an earlier semester.
- The UI shows BYOD present-or-silent (ADR 0011).
