# Exam-plan ingestion

Converts the HSG central exam-plan PDF into `app/public/exams/<SEMESTER>.json`.
Runs **by hand, once per published plan**. Nothing in the app calls it; CI only
runs the tests, which read the committed fixtures. Why it works this way:
`docs/adr/0010-offline-exam-schedule-ingestion.md`.

## Files per semester

| File | What it is |
| ---- | ---------- |
| `docs/exams/<published name>.pdf` | the source PDF from HSG |
| `app/public/exams/<SEMESTER>.json` | the artifact the app fetches as `/exams/<SEMESTER>.json` |
| `app/scripts/ingest-exam-plan/__tests__/fixtures/<name>.txt` | the exact `pdftotext -layout` text, for the golden test |
| `app/scripts/ingest-exam-plan/__tests__/fixtures/<name>.byod.json` | the BYOD shading the CLI read, for the golden test |
| `docs/exams/catalog-<SEMESTER>.json` | optional catalog snapshot; gitignored, never commit it |

`<name>` is the exam period in lower case, e.g. `winter-2027` for HS26. A new
semester adds a new set of files. Keep the earlier semesters' files.

## Prerequisites

```bash
brew install poppler   # pdftotext and pdftocairo
```

The PDF marks a BYOD exam by shading its cell in the colour of the legend
swatch next to "= digitale Prüfungen (BYOD)". `pdftotext -layout` drops the
shading, so with `--pdf` the CLI also reads the page drawing
(`pdftocairo -svg`) and the word positions (`pdftotext -bbox-layout`). Always
ingest from the PDF. `--text` (pre-extracted text) sees no shading and marks
only the exams whose title says "(BYOD)".

## Runbook

Run every command in `app/` (`cd app` from the repository root).

1. **Add the PDF** to `docs/exams/` under its published name, e.g.
   `docs/exams/Prüfungsplan OT Winter 2027.pdf`. Do not overwrite an earlier
   semester's PDF.

2. **Dry run and read the report.**

   ```bash
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" --dry-run
   ```

   The first line names the semester, read from the PDF's title: the title
   names the exam period, so "Winter 2027" is `HS26`. Compare the stats with
   the PDF: number of exams and exam dates, the split by start time, the
   durations and the number of BYOD exams. If there are errors, nothing is
   written. Read every warning: `W_BYOD_LEGEND_MISSING` means the legend's
   wording changed and no shaded exam is marked, so do not write the artifact
   until the parser reads the new legend.

3. **Optional: cross-check against the course catalog.** In the browser, open
   DevTools → Network, load the course list, find the
   `myLatestPublishedPossiblebyTerm` request and copy the **response body
   only** — never the request as cURL, which carries your bearer token. Save it
   as `docs/exams/catalog-HS26.json` and repeat the dry run with it:

   ```bash
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" --dry-run \
     --catalog ../docs/exams/catalog-HS26.json
   ```

   "central courses without exam" should be near-empty. "exams without a
   course" is expected to be long: even-prefixed roots (`4,xxx`, `6,xxx`,
   `8,xxx`) are spring courses cross-listed on an autumn exam. AT rows are left
   out of the check.

4. **Write the artifact and the fixtures.**

   ```bash
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" \
     --save-fixtures scripts/ingest-exam-plan/__tests__/fixtures/winter-2027
   ```

   This writes `public/exams/HS26.json`, `winter-2027.txt` and
   `winter-2027.byod.json`. Do not reformat the fixtures: the parser splits
   pages on the form feeds in the text.

5. **Spot-check about 10 entries** against the PDF: one per start time, a
   cross-listed pair (`3,802 | 4,802`), an AT row, a shaded (BYOD) row and a
   plain one, and an oral exam with its date range.

6. **For a new semester, add a golden case.** `__tests__/goldenFile.test.js`
   rebuilds HS26 from `winter-2027.txt` and `winter-2027.byod.json` and compares
   the result byte for byte with `public/exams/HS26.json` (`SHIPPED_ARTIFACT`).
   Copy its `it` block. In the copy, read the new fixtures (e.g.
   `summer-2027.txt` and `summer-2027.byod.json`) and compare with the new
   artifact (e.g. `public/exams/FS27.json`, in a second constant beside
   `SHIPPED_ARTIFACT`). Do not change the HS26 case.

7. **Run the tests and lint**, then review the artifact's diff line by line.

   ```bash
   npx vitest run
   npm run lint
   ```

   Commit the PDF, the artifact, both fixtures, the golden case (new semester
   only) and a CHANGELOG entry. CI runs the same two commands on every push.

## Re-ingesting a revised plan

When HSG publishes a revised plan for a semester that is already ingested,
replace that semester's PDF in `docs/exams/` and repeat steps 2–5 and 7 with
it, so the committed PDF, artifact and fixtures stay in step. The fixture name
stays the same.

The write refuses to drop exams. If an exam id of the existing
`public/exams/<SEMESTER>.json` is missing from the new plan, nothing is
written and every missing id is listed. An id holds the date and start time,
so an exam that moved is listed too. Check each id against the new PDF. Only if
HSG really dropped or moved those exams, add `--allow-removals` to the step 4
command and run it again.

**HS26 in CW42.** The report prints `W_AT_INCOMPLETE` because the PDF
announces the alternative-date (AT) plan for 08.–20.02.2027 for CW42. The app
uses OT written exams only (the 48 AT rows in the current PDF are the
alternative dates of Summer 2026 courses). So:

- If the CW42 publication is a revised full plan, re-ingest it as above.
- If it lists only AT rows, do not ingest it. The app would gain nothing, and
  the write would drop every OT exam: when the removal check lists them, do not
  override it with `--allow-removals`.
