# Exam-plan ingestion

Converts the HSG central exam-plan PDF into `app/public/exams/<SEMESTER>.json`.
Runs **once per semester, by hand** — nothing in the app calls it, and nothing
in CI runs it.

## Where the data lives

- `docs/exams/<published-name>.pdf` is the committed source document from HSG.
- `app/public/exams/<SEMESTER>.json` is the runtime artifact. The browser fetches
  it as `/exams/<SEMESTER>.json`; exam schedules are not stored in a database.
- `app/scripts/ingest-exam-plan/__tests__/fixtures/<exam-period>.txt` is the
  exact `pdftotext -layout` extraction used by the golden regression test.
- `docs/exams/catalog-<SEMESTER>.json` is an optional, local course-catalog
  cross-check. It is gitignored because the snapshot comes from DevTools.

Keep previous semesters' PDFs, JSON artifacts and golden fixtures. A new
semester adds a new set of files; it does not replace the preceding semester.

## Prerequisites

```bash
brew install poppler   # provides pdftotext; only needed for --pdf
```

## Runbook

1. **Drop the PDF** into `docs/exams/` under its published name, e.g.
   `docs/exams/Prüfungsplan OT Winter 2027.pdf`. For a new semester, add the
   PDF alongside the older plans rather than overwriting one of them.

2. **Dry run and read the report.**

   ```bash
   cd app
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" --dry-run
   ```

   The first line names the semester read from the PDF's title: the PDF names
   the *exam period*, so "Winter 2027" is autumn semester 2026 → `HS26`.

   Check the stats block against the PDF: number of exams, number of exam
   dates, the split by start time (the times come from each page's table
   header) and the duration histogram. Errors mean nothing is written; read
   every warning.

3. **Optional: cross-check against the course catalog.** In the browser, open
   DevTools → Network, load the course list, find the
   `myLatestPublishedPossiblebyTerm` request and copy the **response body
   only** — never the request as cURL, which carries your bearer token. Save it
   to `docs/exams/catalog-HS26.json` (gitignored) and re-run with
   `--catalog ../docs/exams/catalog-HS26.json`. `central courses without exam`
   is the interesting list: it should be near-empty. `exams without a course`
   is expected to be long: even-prefixed roots (`4,xxx`, `6,xxx`, `8,xxx`) are
   spring-semester course numbers cross-listed on an autumn exam, and an
   autumn catalog does not contain them. `AT` rows are left out of the check —
   in this PDF they are the alternative dates of Summer 2026 courses.

4. **Write the artifact** to `public/exams/<SEMESTER>.json`:

   ```bash
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf"
   ```

5. **Spot-check ~10 entries** against the PDF: one from each slot, a
   cross-listed pair (`3,802 | 4,802`), an `AT` row and an oral entry.

6. **Add or refresh the golden fixture.** Extract the exact layout text:

   ```bash
   pdftotext -layout -enc UTF-8 -eol unix "../docs/exams/Prüfungsplan OT Winter 2027.pdf" \
     scripts/ingest-exam-plan/__tests__/fixtures/winter-2027.txt
   ```

   For a revised PDF in the same semester, refresh that semester's existing
   fixture. For a new semester, choose a new fixture name (for example,
   `summer-2027.txt`) and add a corresponding case to
   `__tests__/goldenFile.test.js`; do not repoint the HS26 case or delete its
   files. Each case must rebuild its semester's plan and compare it
   byte-for-byte against the matching `public/exams/<SEMESTER>.json`.

   Review the artifact's diff line by line before blessing it. Do not reformat
   the fixture — the parser splits pages on its form feeds.

7. **`npx vitest run` and `npm run lint`**, then commit the PDF, the artifact
   and the fixture, the golden-test case, and a CHANGELOG entry.

8. **Re-ingest later publications for the same semester.** When HSG publishes
   a new OT plan for the semester, repeat the dry run, write, spot-check,
   fixture and test steps with the new PDF.

   If the report prints `W_AT_INCOMPLETE`, HSG publishes the alternative-date
   (AT) plan later. For HS26 this is the AT plan for 08.–20.02.2027, due in
   CW42. If that PDF lists only AT rows, do not ingest it: keep the current
   artifact. The app uses only the OT written exams, so nothing is lost.

   The write compares the new plan with the existing
   `public/exams/<SEMESTER>.json`. If an exam id of that file is missing from
   the new plan, nothing is written and every missing id is listed. The id
   holds the date and start time, so an exam that moved is listed too. Check
   each listed id against the new PDF. If HSG really dropped or moved these
   exams, run the write again with `--allow-removals`. If the list holds exams
   that are still valid, do not use `--allow-removals`.

   Review the resulting JSON diff as carefully as the initial import.

## Layout

`cli.js` is the only file that touches the filesystem, the process or a child
process. Everything else is pure and unit-tested:

| File                       | Responsibility                                    |
| -------------------------- | ------------------------------------------------- |
| `parseExamPlanText.js`     | raw text → ParsedPlan                             |
| `buildExamPlan.js`         | ParsedPlan → artifact, semester from the title    |
| `zurichTime.js`            | date + wall clock → ISO with the day's UTC offset |
| `validateExamPlan.js`      | errors/warnings/stats; errors gate the write      |
| `validateAgainstCatalog.js`| advisory two-way diff, never fails the build      |
| `formatReport.js`          | the plain-text report                             |

See `docs/adr/0010-offline-exam-schedule-ingestion.md` for why it works this
way.
