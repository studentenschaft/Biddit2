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

- The semester comes from the title. The PDF names the exam period, so
  "Winter 2027" is HS26 and "Summer 2027" is FS27.
- Start times come from each page's own table header
  ("Prüfungsbeginn (schriftl.): hh.mm Uhr"). An exam takes the time of the
  label it starts nearest to, because the columns move from page to page. No
  label, more than two, labels out of order, two headers on one page that
  disagree, or an exam more than 20 columns from every label is fatal.
- BYOD comes from the shading. The PDF fills a digital exam's cell with the
  colour of the legend swatch "= digitale Prüfungen (BYOD)", which
  `pdftotext -layout` drops. The CLI reads the fills (`pdftocairo -svg`) and
  the word positions (`pdftotext -bbox-layout`) and marks each
  (page, term type, root) that sits inside a legend-coloured fill; a title
  that says "(BYOD)" counts as well. A root that is shaded in one row and plain
  in another of the same page and term type is fatal. If no page carries the
  legend's exact words, nothing counts as shaded: only the titled exams are
  marked, and the report warns `W_BYOD_LEGEND_MISSING` ("No BYOD legend found
  — BYOD is marked only from titles"). `--text` input has no shading and marks
  only the titled exams.
- UTC offsets are computed per date for Europe/Zurich, so a summer plan comes
  out in CEST.

**Errors block the write.** Anything the parser cannot place throws. The
validator then re-derives what it can from the raw text: the number of
written rows (`E_COUNT_MISMATCH`), the residue left of each row's first exam
(`E_UNCONSUMED_LINE`), page furniture inside a title (`E_TITLE_BLEED`), dates
outside the exam period, durations outside 30–240 minutes, duplicate ids, and
oral notes that name a course number (`E_ORAL_EXAM_IN_NOTE`, since nothing
else counts oral rows). One error and nothing is written; `--dry-run` reports
without writing.

**A re-ingest cannot shrink the plan unnoticed.** A write over an existing
artifact is refused, listing each id, when an exam of that file is missing from
the new plan. The id holds term type, date, start time and roots, so a moved
exam is listed too. `--allow-removals` overrides once each listed exam has been
checked against the PDF. The file is renamed into place, never half-written.

**Schema version 2.** A written exam carries its date, start time
(`startIso`), duration, term type, roots and title, and `byod: true` only when
marked. The oral page prints no times, only blocks of days (a "-" in the date
gutter opens a range), so an oral exam carries its block's `dateStart` and
`dateEnd` and no time. Version 2 marks that change; the app refuses any other
version (ADR 0011).

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
  parser, not a silently wrong plan. A reworded BYOD legend is the one layout
  change that still writes: it only warns, so read the report's warnings.
- **poppler is a developer prerequisite** for `--pdf` only. The tests and CI
  run off the committed fixtures.
- **Semesters accumulate.** Each one adds its PDF, artifact, two fixtures and a
  golden case, and replaces nothing of an earlier semester.
- BYOD is now as complete as the PDF's shading, but the UI still only ever says
  "digital (BYOD)", never "not BYOD".
