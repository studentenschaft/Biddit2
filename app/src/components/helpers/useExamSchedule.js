import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { examSchedulesState } from "../recoil/examScheduleAtom";

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
 * @param {string|null} semester - Semester shortName, or null to skip loading
 * @returns {{ plan: Object|null }|null} - `plan: null` means "no schedule for
 *   this semester"; the entry's existence is what stops a refetch
 */
export function useExamSchedule(semester) {
  const [schedules, setSchedules] = useRecoilState(examSchedulesState);
  const entry = semester ? schedules[semester] : null;

  useEffect(() => {
    if (!semester || entry) return;

    // Fail open: a 404, unparseable JSON or an unknown schema all mean "no
    // schedule for this semester", never an error the user has to act on. No
    // retry either — a static asset that is not there will not appear. The
    // result lands in a session-wide atom, so no unmount cleanup: discarding
    // an in-flight response would just force a refetch on the next mount.
    fetch(`/exams/${semester}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((plan) => {
        const usable = plan?.schemaVersion === SUPPORTED_SCHEMA_VERSION;
        setSchedules((previous) => ({
          ...previous,
          [semester]: { plan: usable ? plan : null },
        }));
      });
  }, [semester, entry, setSchedules]);

  return entry ?? null;
}
