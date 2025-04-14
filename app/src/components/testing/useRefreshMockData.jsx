import { useSetRecoilState } from 'recoil';
//import { scorecardEnrollmentsState } from '../recoil/scorecardEnrollmentsAtom';
//import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { scorecardDetailsState } from '../recoil/scorecardDetailsAtom';
import { getMockScorecard } from '../testing/mockAPIService';
import { useCallback } from 'react';

export const useRefreshMockData = () => {
  const setScoreCardDetails = useSetRecoilState(scorecardDetailsState);

  const refreshMockData = useCallback(   // Memoized refreshMockData
    (selectedDegree) => {
      if (!selectedDegree) return;

      const mockData = getMockScorecard(selectedDegree);

      // Update scorecard details
      setScoreCardDetails(mockData);

      console.log('Mock data refreshed for degree:', selectedDegree);
    },
    [setScoreCardDetails] // Dependency array
  );

  return refreshMockData;
};