import { useEffect } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { authTokenState } from '../recoil/authAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { fetchScoreCardDetails } from '../recoil/ApiScorecardDetails';
import { devModeState } from '../testing/devModeAtom';

export const useInitializeScoreCards = (handleError) => {
  const setScoreCardData = useSetRecoilState(scorecardDataState);
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);
  const devMode = useRecoilValue(devModeState);

  const existingData = useRecoilValue(scorecardDataState);

    useEffect(() => {
    // If missing auth or enrollments, skip
    if (!authToken || !currentEnrollments?.enrollmentInfos) return;

    // If data is already loaded or loading, skip
    if (existingData.isLoaded || existingData.loading) {
        return;
      }
    
      const fetchAllScorecards = async () => {
        // Mark as loading
        setScoreCardData(curr => ({ ...curr, loading: true }));
  
        try {
            const results = await Promise.all(
            currentEnrollments.enrollmentInfos.map(async (enrollment) => {
                const attempt = enrollment.attempt || 1;
                const rawScorecard = await fetchScoreCardDetails(
                authToken,
                enrollment.studyRegulationId,
                attempt,
                devMode,
                enrollment.studyProgramShortName
                );

                if (!rawScorecard.success) {
                  return {
                    programId: enrollment.studyProgramDescription,
                    data: rawScorecard.data,
                    success: false
                  };
                } else {
                  return {
                    programId: enrollment.studyProgramDescription,
                    data: rawScorecard.data,
                    success: true
                  };
                }
            })
            );

            const rawScorecards = results.reduce((acc, { programId, data, success }) => {
              acc[programId] = data;
              if (!success) {
                throw new Error(`Failed to fetch scorecard for ${programId}`);
              }
              return acc;
            }, {});

            setScoreCardData({
            rawScorecards,
            isLoaded: true,
            loading: false,
            error: null,
            lastFetched: new Date().toISOString()
            });
      } catch (error) {
        console.error('Error fetching scorecards:', error);
        handleError(error);
        setScoreCardData(curr => ({
          ...curr,
          loading: false,
          error: error.message
        }));
      }
    };

    if (authToken && currentEnrollments?.enrollmentInfos) {
      fetchAllScorecards();
    }
  }, [authToken, currentEnrollments, devMode, handleError, setScoreCardData]);
};