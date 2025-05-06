import { useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { useTermSelection } from "./useTermSelection";
import { useCurrentSemester, removeSpacesFromSemesterName } from "./studyOverviewHelpers";

/**
 * Custom hook that prefetches data for all future semesters to ensure the study overview
 * shows all saved courses without requiring manual semester selection.
 * @returns {Object} { isPrefetching: boolean, prefetchComplete: boolean }
 */
export const usePrefetchSemesters = () => {
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchComplete, setPrefetchComplete] = useState(false);
  
  const {
    selectedSem,
    sortedTermShortNames,
    handleTermSelect,
    latestValidTerm,
  } = useTermSelection();
  
  const currentSemester = useCurrentSemester();
  
  useEffect(() => {
    // Skip if we've already completed prefetching or are currently prefetching
    if (prefetchComplete || isPrefetching || !selectedSem || !sortedTermShortNames.length || !currentSemester) {
      return;
    }

    const originalSemester = selectedSem;
    
    const prefetchSemesters = async () => {
    setIsPrefetching(true);
    console.log("🔄 Starting semester data prefetch...");
    
    // Find current semester index
    const currentSemesterKey = removeSpacesFromSemesterName(currentSemester);
    const currentIndex = sortedTermShortNames.findIndex(
    term => removeSpacesFromSemesterName(term) === currentSemesterKey
    );
    
    if (currentIndex === -1) {
    console.error("Could not find current semester in term list");
    setIsPrefetching(false);
    setPrefetchComplete(true);
    return;
    }
    
    console.log('🔄 sortedTermShortNames:', sortedTermShortNames);
    console.log('🔄 currentIndex:', currentIndex);
    console.log('🔄 currentSemesterKey:', currentSemesterKey);
    // Get future semesters (they come after current in sortedTermShortNames)
    // Note: sortedTermShortNames is sorted from newest to oldest, so future semesters have lower indices
    const futureSemesters = sortedTermShortNames.filter(semester => {
      const semesterYear = parseInt(removeSpacesFromSemesterName(semester).slice(2));
      const currentYear = parseInt(removeSpacesFromSemesterName(currentSemester).slice(2));
      const isSpringSemester = semester.startsWith('FS');
      const isCurrentSpringSemester = currentSemester.startsWith('FS');
      
      // Compare years first
      if (semesterYear > currentYear) {
        console.log(`🔄 ${semester} is future year vs ${currentSemester} (FUTURE)`);
        return true;
      }
      if (semesterYear < currentYear) {
        console.log(`🔄 ${semester} is past year vs ${currentSemester} (PAST)`);
        return false;
      }

      // Same year - check semester type
      // HS (Fall) comes AFTER FS (Spring) in the same year
      if (!isSpringSemester && isCurrentSpringSemester) {
        console.log(`🔄 ${semester} is HS and ${currentSemester} is FS in same year (FUTURE)`);
        return true;
      }
      
      console.log(`🔄 ${semester} is not future compared to ${currentSemester} (PAST/CURRENT)`);
      return false;
    });

    console.log('🔄 Semesters:', futureSemesters);

    // Prefetch each future semester
    for (const semester of futureSemesters) {
    console.log(`🔄 Prefetching data for ${semester}...`);
    handleTermSelect(semester);
    // Wait for data to load
    await new Promise(resolve => setTimeout(resolve, 750));
    }
    
    // Return to original semester
    if (originalSemester !== selectedSem) {
    handleTermSelect(originalSemester);
    }
    
    console.log("✅ Semester data prefetching complete");
    setIsPrefetching(false);
    setPrefetchComplete(true);
    };
    
    // Start prefetching after a short delay to ensure initial rendering is complete
    const timer = setTimeout(prefetchSemesters, 1000);
    return () => clearTimeout(timer);
  }, [
    selectedSem,
    sortedTermShortNames,
    handleTermSelect,
    latestValidTerm,
    isPrefetching,
    prefetchComplete,
    currentSemester
  ]);

  return { isPrefetching, prefetchComplete };
};
