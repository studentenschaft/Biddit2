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

2. **Pick the semester key.** It is never inferred from the PDF, because the
   PDF names the *exam period*, not the semester it belongs to:

   | PDF says      | Semester key |
   | ------------- | ------------ |
   | Winter *YYYY* | HS(*YYYY*−1) |
   | Summer *YYYY* | FS(*YYYY*)   |

   "Winter 2027" is the exam period of autumn semester 2026 → `HS26`.

3. **Dry run and read the report.**

   ```bash
   cd app
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" --semester HS26
   ```

   Without `--out` nothing is written — this is the dry run.

   Check the stats block against the PDF: number of exams, number of exam
   dates, the 09:15/15:15 split and the duration histogram. Errors mean nothing
   is written; warnings are informational and expected (see below).

4. **Optional: cross-check against the course catalog.** In the browser, open
   DevTools → Network, load the course list, find the
   `myLatestPublishedPossiblebyTerm` request and copy the **response body
   only** — never the request as cURL, which carries your bearer token. Save it
   to `docs/exams/catalog-HS26.json` (gitignored) and re-run with
   `--catalog ../docs/exams/catalog-HS26.json`. `central courses without exam`
   is the interesting list: it should be near-empty. `exams without a course`
   is expected to be long — `4,xxx` roots are alternative-date variants that
   the catalog does not list separately.

5. **Write the artifact.**

   ```bash
   npm run ingest:exams -- --pdf "../docs/exams/Prüfungsplan OT Winter 2027.pdf" --semester HS26 --out public/exams/HS26.json
   ```

6. **Spot-check ~10 entries** against the PDF: one from each slot, a
   cross-listed pair (`3,802 | 4,802`), an `AT` row and an oral entry.

7. **Add or refresh the golden fixture.** Extract the exact layout text:

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
   the fixture — losing its form feeds degrades page splitting to the banner
   fallback.

8. **`npm test` and `npm run lint`**, then commit the PDF, the artifact and the
   fixture, the golden-test case, and a CHANGELOG entry.

9. **Re-ingest later publications for the same semester.** If the report prints
   `W_AT_INCOMPLETE`, repeat the dry run, write, spot-check, fixture and test
   steps when HSG publishes the complete alternative-date plan. Review the
   resulting JSON diff as carefully as the initial import.

## Options

| Flag               | Meaning                                       |
| ------------------ | --------------------------------------------- |
| `--pdf <file>`     | PDF input; converted with `pdftotext -layout` |
| `--text <file>`    | pre-extracted text input; skips poppler       |
| `--semester <key>` | required, e.g. `HS26`                         |
| `--out <file>`     | where to write; omit for a dry run            |
| `--catalog <file>` | catalog snapshot for the advisory cross-check |

Exit codes: `0` clean, `1` validation errors (nothing written), `2` usage or
I/O problem (including a missing `pdftotext`).

## Known limitations

The report prints them on every run as warnings — `W_BYOD_GLYPH_LOST` (BYOD is
a lower bound), `W_AT_INCOMPLETE` (re-ingest once the full AT plan is
published) and `W_ORAL_NO_TIMES` (oral slots appear in Compass later; never
invent a time). The rationale lives in the "Consequences" section of
`docs/adr/0007-offline-exam-schedule-ingestion.md`.

## Layout

`cli.js` is the only file that touches the filesystem, the process or a child
process. Everything else is pure and unit-tested:

| File                       | Responsibility                                    |
| -------------------------- | ------------------------------------------------- |
| `parseExamPlanText.js`     | raw text → ParsedPlan                             |
| `buildExamPlan.js`         | ParsedPlan + semester/source → artifact           |
| `zurichTime.js`            | date + wall clock → ISO with the day's UTC offset |
| `validateExamPlan.js`      | errors/warnings/stats; errors gate the write      |
| `validateAgainstCatalog.js`| advisory two-way diff, never fails the build      |
| `formatReport.js`          | the plain-text report                             |

See `docs/adr/0007-offline-exam-schedule-ingestion.md` for why it works this
way.
