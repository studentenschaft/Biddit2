// useMergeWishlistedCourses.js //

// Hook to enable both Transcript and StudyOverview to initialize the data

// Final output: enriched scorecard containing both official transcript and wishlist courses

import { useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { mergedScorecardBySemesterAtom } from "../recoil/mergedScorecardBySemesterAtom";
import { transformedScorecardsSelector } from "../recoil/transformedScorecardsSelector";
import { studyPlanAtom } from "../recoil/studyPlanAtom";
import { semesterMapSelector } from "../recoil/semesterMapAtom";
import { mergeWishlistedCourses } from "../helpers/mergeWishlistedCourses";

export const useMergeWishlistedCourses = (authToken, currentSemester, categoryTypeMap, handleError) => {
  const [mergedScorecardBySemester, setMergedScorecardBySemester] = useRecoilState(mergedScorecardBySemesterAtom);
  const baseMergedScorecards = useRecoilValue(transformedScorecardsSelector);
  const studyPlan = useRecoilValue(studyPlanAtom);
  const semesterMap = useRecoilValue(semesterMapSelector);

  useEffect(() => {
    // Only trigger if we have the necessary auth and enrollment data,
    // and if we haven't already merged the wishlist courses (i.e. mergedScorecardBySemester is null)
    if (!authToken) return;
    if (mergedScorecardBySemester !== null) return;
    if (!studyPlan || studyPlan.isLoading) return;
    if (!baseMergedScorecards || Object.keys(baseMergedScorecards).length === 0) return;

    (async () => {
      try {
        const merged = await mergeWishlistedCourses(
          baseMergedScorecards,
          studyPlan.allPlans,
          semesterMap,
          handleError,
          authToken,
          currentSemester,
          categoryTypeMap
        );
        setMergedScorecardBySemester(merged);
      } catch (err) {
        console.error("Wishlist merge error:", err);
        handleError(err);
      }
    })();
  }, [
    authToken,
    mergedScorecardBySemester,
    studyPlan,
    baseMergedScorecards,
    semesterMap,
    currentSemester,
    categoryTypeMap,
    handleError
  ]);
};