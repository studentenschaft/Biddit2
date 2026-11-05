/**
 * useVectorSearch
 *
 * The one query sequence behind smart search and Similar Courses: derive the
 * programme, pick the semester the displayed courses belong to, query the
 * vector DB, and when the term's catalog is not embedded yet (an empty ids list
 * or a 404) upsert it once and query once more. All HTTP lives in
 * `similarCoursesApi.js`; the upsert there keeps its own borrowed-data guard.
 * See REFERENCE_SEMESTER.md.
 */

import { useState } from "react";
import { useRecoilValue } from "recoil";
import { querySimilarCourses, upsertSimilarCourses } from "./similarCoursesApi";
import { useScorecardFetching } from "./useScorecardFetching";
import { authTokenState } from "../recoil/authAtom";
import {
  availableCoursesSelector,
  selectedSemesterSelector,
  semesterMetadataSelector,
} from "../recoil/unifiedCourseDataSelectors";
import { mainProgramSelector } from "../recoil/unifiedAcademicDataSelectors";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { unifiedAcademicDataState } from "../recoil/unifiedAcademicDataAtom";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { log } from "./log";

const noHits = () => ({ ids: [], distances: [], metadatas: [] });

/**
 * One query. `catalogMissing` is true only for an explicit empty ids list or a
 * 404: a body without `ids` (e.g. `{ message }`) is the DB declining to answer
 * and must never trigger a full-catalog upsert.
 */
async function queryOnce(params) {
  try {
    const { data } = await querySimilarCourses(params);
    const ids = data?.ids?.[0];
    if (!ids) return { hits: noHits(), catalogMissing: false };
    return {
      hits: {
        ids,
        distances: data.distances?.[0] ?? [],
        metadatas: data.metadatas?.[0] ?? [],
      },
      catalogMissing: ids.length === 0,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { hits: noHits(), catalogMissing: true };
    }
    console.error("Error querying similar courses:", error);
    errorHandlingService.handleError(error);
    return { hits: noHits(), catalogMissing: false };
  }
}

function toUpsertPayload(courses) {
  return (courses || []).filter((course) => {
    if (course.courseNumber) return true;
    console.warn("Missing course number for course:", course);
    return false;
  });
}

export function useVectorSearch() {
  const authToken = useRecoilValue(authTokenState);
  const scorecardFetching = useScorecardFetching();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpserting, setIsUpserting] = useState(false);

  const selectedSemester = useRecoilValue(selectedSemesterSelector);
  const semesterMetadata = useRecoilValue(
    semesterMetadataSelector(selectedSemester)
  );
  // Borrowed data (a projected term or a current-but-sparse preview) belongs to
  // referenceSemester, so queries must target it, never the selected term.
  const isReferenceData = Boolean(
    semesterMetadata?.isFutureSemester || semesterMetadata?.usingReferenceData
  );
  const referenceSemester = semesterMetadata?.referenceSemester || null;
  const coursesCurrentSemester = useRecoilValue(
    availableCoursesSelector(selectedSemester)
  );

  const mainProgram = useRecoilValue(mainProgramSelector);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const academicData = useRecoilValue(unifiedAcademicDataState);
  const derivedProgram =
    mainProgram?.metadata?.programDescription ||
    mainProgram?.programName ||
    currentEnrollments?.enrollmentInfos?.find((e) => e.isMainStudy)
      ?.studyProgramDescription ||
    (academicData?.programs ? Object.keys(academicData.programs)[0] : null) ||
    null;

  async function resolveProgram() {
    if (derivedProgram || !authToken) return derivedProgram;
    try {
      const result = await scorecardFetching.fetchAll(authToken);
      return (result?.data && Object.keys(result.data)[0]) || null;
    } catch (error) {
      console.error("Failed to prefetch scorecard data:", error);
      return null;
    }
  }

  /**
   * Query the vector DB for courses similar to `courseDescription`.
   * Resolves `{ ids, distances, metadatas }` for the first (only) query, with
   * empty arrays when nothing is found or the query cannot run.
   */
  async function runQuery({ courseDescription, category = null }) {
    setIsLoading(true);
    try {
      const program = await resolveProgram();
      if (!program) {
        log.debug("No programme known; vector search skipped");
        return noHits();
      }
      if (isReferenceData && !referenceSemester) {
        log.debug(
          `${selectedSemester} shows borrowed data without a reference semester; vector search skipped`
        );
        return noHits();
      }
      const semester = isReferenceData ? referenceSemester : selectedSemester;
      if (!semester) {
        console.warn("No semester is selected or available for vector search");
        return noHits();
      }

      const params = {
        authToken,
        courseDescription,
        category,
        program,
        semester,
      };
      const first = await queryOnce(params);
      if (!first.catalogMissing) return first.hits;

      // upsertSimilarCourses reports and swallows its own errors.
      setIsUpserting(true);
      await upsertSimilarCourses({
        authToken,
        courses: toUpsertPayload(coursesCurrentSemester),
        program,
        selectedSemester,
        referenceSemester,
        isReferenceData,
        source: "useVectorSearch",
      });
      setIsUpserting(false);
      return (await queryOnce(params)).hits;
    } finally {
      setIsUpserting(false);
      setIsLoading(false);
    }
  }

  return { runQuery, isLoading, isUpserting };
}
