/**
 * useScorecardFetching - CONTROLLED FETCHING VERSION
 * 
 * Adds controlled fetching capability to the minimal access hook
 * Only fetches when explicitly called, not on mount
 */

import { useState, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { fetchScoreCardDetails } from '../recoil/ApiScorecardDetails';
import { fetchCurrentEnrollments } from '../recoil/ApiCurrentEnrollments';
import { useScorecardAccess } from './useScorecardAccess';

/**
 * Hook that combines data access with controlled fetching
 * Fetching is MANUAL ONLY - must be explicitly triggered
 */
export const useScorecardFetching = () => {
  const scorecardAccess = useScorecardAccess();
  const setScorecardData = useSetRecoilState(scorecardDataState);
  const setCurrentEnrollments = useSetRecoilState(currentEnrollmentsState);
  
  const [fetchingState, setFetchingState] = useState({
    isFetchingEnrollments: false,
    isFetchingScorecards: false,
    lastError: null
  });

  // Manual enrollment fetching
  const fetchEnrollments = useCallback(async (authToken) => {
    if (!authToken) {
      console.log('📊 useScorecardFetching: No auth token for enrollment fetch');
      return { success: false, error: 'No auth token' };
    }

    if (scorecardAccess.hasEnrollments) {
      console.log('📊 useScorecardFetching: Enrollments already loaded');
      return { success: true, data: scorecardAccess.enrollments };
    }

    setFetchingState(prev => ({ ...prev, isFetchingEnrollments: true, lastError: null }));
    console.log('📊 useScorecardFetching: Fetching enrollments...');

    try {
      const enrollmentData = await fetchCurrentEnrollments(authToken);
      if (enrollmentData?.enrollmentInfos) {
        setCurrentEnrollments(enrollmentData);
        setFetchingState(prev => ({ ...prev, isFetchingEnrollments: false }));
        console.log('📊 useScorecardFetching: Enrollments fetched successfully');
        return { success: true, data: enrollmentData };
      } else {
        throw new Error('No enrollment data received');
      }
    } catch (error) {
      console.error('📊 useScorecardFetching: Error fetching enrollments:', error);
      setFetchingState(prev => ({ 
        ...prev, 
        isFetchingEnrollments: false, 
        lastError: error.message 
      }));
      return { success: false, error: error.message };
    }
  }, [scorecardAccess.hasEnrollments, scorecardAccess.enrollments, setCurrentEnrollments]);

  // Manual scorecard fetching
  const fetchScorecards = useCallback(async (authToken, enrollmentData = null) => {
    if (!authToken) {
      return { success: false, error: 'No auth token' };
    }

    // Use provided enrollment data or current data
    const enrollmentsToUse = enrollmentData?.enrollmentInfos || scorecardAccess.enrollments?.enrollmentInfos;
    
    if (!enrollmentsToUse?.length) {
      return { success: false, error: 'No enrollment data available' };
    }

    if (scorecardAccess.hasData && !scorecardAccess.isLoading) {
      console.log('📊 useScorecardFetching: Scorecards already loaded');
      return { success: true, data: scorecardAccess.rawScorecards };
    }

    setFetchingState(prev => ({ ...prev, isFetchingScorecards: true, lastError: null }));
    setScorecardData(curr => ({ ...curr, loading: true, error: null }));

    console.log('📊 useScorecardFetching: Fetching scorecards for', enrollmentsToUse.length, 'programs');

    try {
      const results = await Promise.all(
        enrollmentsToUse.map(async (enrollment) => {
          try {
            const rawScorecard = await fetchScoreCardDetails(
              authToken,
              enrollment.studyRegulationId,
              enrollment.attempt || 1
            );

            return {
              programId: enrollment.studyProgramDescription,
              data: rawScorecard.success ? rawScorecard.data : null,
              success: rawScorecard.success,
              error: rawScorecard.success ? null : rawScorecard.data
            };
          } catch (error) {
            return {
              programId: enrollment.studyProgramDescription,
              data: null,
              success: false,
              error: error.message
            };
          }
        })
      );

      // Process results
      const rawScorecards = {};
      const errors = [];

      results.forEach(({ programId, data, success, error }) => {
        if (success && data) {
          rawScorecards[programId] = data;
        } else {
          errors.push(`${programId}: ${error}`);
        }
      });

      setScorecardData({
        rawScorecards,
        isLoaded: Object.keys(rawScorecards).length > 0,
        loading: false,
        error: errors.length > 0 ? `Some programs failed: ${errors.join(', ')}` : null,
        lastFetched: new Date().toISOString()
      });

      setFetchingState(prev => ({ ...prev, isFetchingScorecards: false }));

      console.log('📊 useScorecardFetching: Fetched scorecards for', Object.keys(rawScorecards).length, 'programs');
      return { success: true, data: rawScorecards, errors };

    } catch (error) {
      console.error('📊 useScorecardFetching: Fatal error during scorecard fetch:', error);
      setScorecardData(curr => ({ ...curr, loading: false, error: error.message }));
      setFetchingState(prev => ({ 
        ...prev, 
        isFetchingScorecards: false, 
        lastError: error.message 
      }));
      return { success: false, error: error.message };
    }
  }, [scorecardAccess.enrollments, scorecardAccess.hasData, scorecardAccess.isLoading, setScorecardData]);

  // Combined fetch function
  const fetchAll = useCallback(async (authToken) => {
    console.log('📊 useScorecardFetching: Starting complete fetch sequence');
    
    // Step 1: Fetch enrollments
    const enrollmentResult = await fetchEnrollments(authToken);
    if (!enrollmentResult.success) {
      return { success: false, error: `Failed to fetch enrollments: ${enrollmentResult.error}` };
    }

    // Step 2: Fetch scorecards using enrollment data
    const scorecardResult = await fetchScorecards(authToken, enrollmentResult.data);
    return scorecardResult;
  }, [fetchEnrollments, fetchScorecards]);

  return {
    // Include all data access from minimal hook
    ...scorecardAccess,
    
    // Fetching states
    isFetchingEnrollments: fetchingState.isFetchingEnrollments,
    isFetchingScorecards: fetchingState.isFetchingScorecards,
    lastError: fetchingState.lastError,
    
    // Manual fetch functions
    fetchEnrollments,
    fetchScorecards,
    fetchAll
  };
};

export default useScorecardFetching;