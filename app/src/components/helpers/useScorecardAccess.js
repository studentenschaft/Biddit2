/**
 * useScorecardAccess - MINIMAL SAFE VERSION
 * 
 * Only provides READ access to existing scorecard data
 * NO automatic fetching to avoid crashes
 */

import { useRecoilValue } from 'recoil';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';

/**
 * Minimal hook that only reads existing scorecard data
 * No side effects, no fetching, no state updates
 */
export const useScorecardAccess = () => {
  const scorecardData = useRecoilValue(scorecardDataState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);

  // Simple return object - no complex logic
  return {
    // Basic data access
    rawScorecards: scorecardData?.rawScorecards || {},
    isLoaded: scorecardData?.isLoaded || false,
    isLoading: scorecardData?.loading || false,
    error: scorecardData?.error || null,
    
    // Enrollment data  
    enrollments: currentEnrollments,
    hasEnrollments: Boolean(currentEnrollments?.enrollmentInfos?.length),
    
    // Simple helpers
    hasData: Boolean(scorecardData?.isLoaded && Object.keys(scorecardData?.rawScorecards || {}).length > 0),
    programIds: Object.keys(scorecardData?.rawScorecards || {})
  };
};

export default useScorecardAccess;