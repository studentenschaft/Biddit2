# Reference semesters & preview data

This document explains how `referenceSemester` and `usingReferenceData` are set,
why they exist, and the invariants that downstream features (especially the
similar-courses vector DB) depend on. Read this before touching the course-load
fallback, the unified semester state, or the similar-courses query/upsert.

## The problem they solve

The UniSG EventApi creates a term shell (e.g. `HS26`) and may even mark it
`isCurrent` **before any courses are published**. If we showed that term as-is,
the user would see an empty or near-empty course list during the bidding window.

To avoid that, a term whose own catalog is empty/sparse (fewer than
`REFERENCE_FALLBACK_MIN_COURSES`, see `useCourseInfoData.js`) or whose catalog
errors is shown with a **preview**: the same-season previous-year catalog
(`HS26 → HS25`, `FS27 → FS26`). This is the "reference semester."

The borrowed courses are displayed under the selected term, but they **do not
belong to it**. That distinction is the whole point of this document.

## The two signals

| Field | Meaning | Set where |
|-------|---------|-----------|
| `referenceSemester` | The same-season previous-year term these courses really come from (a `shortName` like `"HS25"`). A stable, deterministic property of *any* term. | `useTermSelection.js` (computed for every term) → stored via `useEventListDataManager.js` → `initializeUnifiedSemester`. Re-asserted in `updateAvailableCourses` when a preview loads. |
| `usingReferenceData` | Transient: is the `available` array **right now** holding the reference preview rather than the term's own catalog? | `useCourseInfoData.js` passes it to `updateAvailableCourses`; persisted on the semester (it is NOT a guarded metadata key). |

`referenceSemester` is the **value**; `usingReferenceData` is the **state**.

### Why `referenceSemester` is computed for every term

`referenceSemester` is deterministic (`computeExpectedReference` in
`useUnifiedCourseData.js`: strip the season, subtract one year). It is computed
for *all* terms in `useTermSelection.js` — not only future/projected ones — so
the preview can kick in for the current term too. Because it is deterministic,
**routing must never depend on `usingReferenceData` alone**: if a code path knows
it is showing borrowed data, a valid `referenceSemester` must already be present.
`updateAvailableCourses` enforces this — when a preview loads it resolves
`referenceSemester` from the caller's value, falling back to
`computeExpectedReference`, so a current sparse term is never left with
`referenceSemester = null`.

## Two kinds of "borrowed" terms

Both display reference courses, but they reach that state differently:

1. **Projected/future semesters** (`isProjected`/`isFuture`/`isFutureSemester`
   true): artificially generated in `useTermSelection.js`. Their `cisId` *is* the
   reference term's `cisId`, so the catalog is fetched directly — `usingReferenceData`
   is typically **false** even though the data is the reference catalog.
2. **Current-but-sparse terms** (`isCurrent` true, `isFutureSemester` false): a
   real API term whose own catalog is empty/sparse, so `useCourseInfoData.js`
   falls back to the reference catalog — `usingReferenceData` is **true**.

> The single correct predicate for "are the displayed courses borrowed?" is
> therefore **`isFutureSemester || usingReferenceData`**. Checking only
> `isFutureSemester` (the historical bug) misses case 2 and silently treats a
> current-term preview as genuine current-term data.

## Why this matters: the vector DB

The left-column smart-search mode (`helpers/useSmartSearch.js`) and
`SimilarCourses` query and upsert an embeddings DB keyed by `semester`. They
must use the semester the courses **actually belong to**:

- **Query**: use `referenceSemester` when borrowed, else the selected term. (A
  user viewing the `HS26` preview expects `HS25` matches, because that is the
  data that exists.)
- **Upsert (guardrail)**: **never upsert borrowed courses.** When
  `isFutureSemester || usingReferenceData`, the upsert is skipped entirely. Only
  a term's own published catalog is ever written, under its own key.

### The regression this prevents

In commit `32de03a` the sparse-current-term preview was added, but:

1. The fallback was no longer gated on `isFuture`, so it began mirroring
   reference data onto the real `isCurrent` term (`HS26`).
2. The reference link was not reliably surfaced to consumers, and the consumers
   only checked `isFutureSemester` (false for a current term).

Result: the semantic search's live upsert (then the `SmartSearch` tab, now
`useSmartSearch`) tagged `HS25` courses with
`semester: "HS26"` and wrote them to the DB, and queries hit the polluted
`HS26` namespace instead of `HS25`. The fixes in this document's invariants
(expose `usingReferenceData`, route on `isFutureSemester || usingReferenceData`,
keep `referenceSemester` always populated, and skip upserts of borrowed data)
close that hole.

## Invariants to preserve

1. `usingReferenceData === true` ⇒ `referenceSemester` is a valid `shortName`.
2. Borrowed-data detection uses `isFutureSemester || usingReferenceData`, never
   `isFutureSemester` alone.
3. The vector DB is only ever written with a term's **own** published catalog,
   under that term's **own** `semester` key.
4. `referenceSemester` is a guarded metadata key (`SEMESTER_METADATA_KEYS`); set
   it via `updateSemesterMetadata` / init, not a plain `patchSemester` data write.
