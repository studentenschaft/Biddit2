import { useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { examSchedulesState } from "../recoil/examScheduleAtom";
import { semesterMetadataSelector } from "../recoil/unifiedCourseDataSelectors";

// Bumped by the ingestion pipeline when the artifact shape changes; a plan we
// do not understand is treated as absent rather than rendered half-blind.
const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Loads the ingested exam plan for a semester, once per session.
 *
 * Deliberately a plain `fetch` rather than `apiClient`: this is a static asset
 * shipped in `public/`, it carries no auth and it is not SHSG traffic, so the
 * interceptors have nothing to contribute. See ADR 0008.
 *
 * The borrowed-data gate lives here rather than in the callers: a semester
 * showing a reference term's catalog behaves exactly like `null`, so no surface
 * can forget the guard and attach someone else's exam dates to those courses.
 * See REFERENCE_SEMESTER.md.
 *
 * @param {string|null} semester - Semester shortName, or null to skip loading
 * @returns {{ plan: Object|null }|null} - `plan: null` means "no schedule for
 *   this semester"; the entry's existence is what stops a refetch
 */
export function useExamSchedule(semester) {
  const [schedules, setSchedules] = useRecoilState(examSchedulesState);
  const metadata = useRecoilValue(semesterMetadataSelector(semester || ""));
  // Borrowed catalogs (projected term, or a current term previewing the
  // previous year) show courses that are not actually running this term, so
  // their exam dates would be someone else's.
  const ownSemester =
    semester && !metadata.isFutureSemester && !metadata.usingReferenceData
      ? semester
      : null;
  const entry = ownSemester ? schedules[ownSemester] : null;

  useEffect(() => {
    if (!ownSemester || entry) return;

    // Fail open: a 404, unparseable JSON or an unknown schema all mean "no
    // schedule for this semester", never an error the user has to act on. No
    // retry either — a static asset that is not there will not appear. The
    // result lands in a session-wide atom, so no unmount cleanup: discarding
    // an in-flight response would just force a refetch on the next mount.
    fetch(`/exams/${ownSemester}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((plan) => {
        const understood = plan?.schemaVersion === SUPPORTED_SCHEMA_VERSION;
        setSchedules((previous) => ({
          ...previous,
          [ownSemester]: { plan: understood ? plan : null },
        }));
      });
  }, [ownSemester, entry, setSchedules]);

  return entry ?? null;
}
