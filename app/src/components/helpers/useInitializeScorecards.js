import { useEffect } from 'react';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { scorecardDataState } from '../recoil/scorecardsAllRawAtom';
import { unifiedAcademicDataState } from '../recoil/unifiedAcademicDataAtom';
import { unifiedCourseDataState } from '../recoil/unifiedCourseDataAtom';
import { authTokenState } from '../recoil/authAtom';
import { currentEnrollmentsState } from '../recoil/currentEnrollmentsAtom';
import { fetchScoreCardDetails } from '../recoil/ApiScorecardDetails';
import {
  findMainProgram,
  buildTranscriptView,
  buildStudyOverviewView,
  calculateProgramStats
} from './academicDataTransformers';

export const useInitializeScoreCards = (handleError) => {
  const setScoreCardData = useSetRecoilState(scorecardDataState);
  const setUnifiedAcademicData = useSetRecoilState(unifiedAcademicDataState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const authToken = useRecoilValue(authTokenState);
  const currentEnrollments = useRecoilValue(currentEnrollmentsState);

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
              attempt
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

        // LEGACY: Update scorecardDataState for backward compatibility
        setScoreCardData({
          rawScorecards,
          isLoaded: true,
          loading: false,
          error: null,
          lastFetched: new Date().toISOString()
        });

        // NEW: Transform and store in unified academic data state
        if (Object.keys(rawScorecards).length > 0) {
          const mainProgramId = findMainProgram(rawScorecards);
          const programs = {};

          Object.entries(rawScorecards).forEach(([programId, rawData]) => {
            const isMainProgram = programId === mainProgramId;
            const transcriptView = buildTranscriptView(rawData);
            const studyOverviewView = buildStudyOverviewView(
              rawData,
              unifiedCourseData,
              programId,
              isMainProgram
            );

            const programStats = calculateProgramStats(
              transcriptView.completedCourses,
              Object.values(studyOverviewView).flatMap(s => s.selectedCourses || []),
              rawData
            );

            programs[programId] = {
              transcript: {
                rawScorecard: rawData,
                processedTranscript: transcriptView,
                mergedTranscript: null,
                lastFetched: Date.now()
              },
              studyPlan: {
                semesterMap: studyOverviewView,
                progress: {
                  totalCreditsRequired: programStats.creditsRequired,
                  totalCreditsCompleted: programStats.creditsEarned,
                  totalCreditsPlanned: 0,
                  completionPercentage: programStats.completionPercentage,
                  estimatedCompletion: null
                },
                lastUpdated: Date.now()
              },
              metadata: {
                programId,
                isMainStudy: rawData.isMainStudy || isMainProgram,
                programType: programId.toLowerCase().includes('master') ? 'master' :
                             programId.toLowerCase().includes('bachelor') ? 'bachelor' : 'other',
                requirementsFulfilled: {
                  creditsDE: rawData.creditsFulfilledDe === true,
                  creditsEN: rawData.creditsFulfilledEn === true,
                  overall: rawData.creditsFulfilledDe === true && rawData.creditsFulfilledEn === true
                }
              }
            };
          });

          setUnifiedAcademicData({
            programs,
            currentProgram: mainProgramId,
            initialization: {
              isLoading: false,
              isInitialized: true,
              error: null,
              lastInitialized: Date.now()
            }
          });
        }
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
  }, [authToken, currentEnrollments, handleError, setScoreCardData, setUnifiedAcademicData, unifiedCourseData]);
};