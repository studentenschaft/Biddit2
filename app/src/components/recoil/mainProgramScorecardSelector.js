import { selector } from 'recoil';
import { scorecardDataState } from './scorecardsAllRawAtom';
import { currentEnrollmentsState } from './currentEnrollmentsAtom';

export const mainProgramScorecardSelector = selector({
  key: 'mainProgramSelector',
  get: ({get}) => {
    const scorecardData = get(scorecardDataState);
    const currentEnrollments = get(currentEnrollmentsState);

    if (!scorecardData?.rawScorecards || !currentEnrollments?.enrollmentInfos) {
      return null;
    }

    const mainStudy = currentEnrollments.enrollmentInfos.find(
      enrollment => enrollment.isMainStudy
    );

    if (!mainStudy) return null;

    return scorecardData.rawScorecards[mainStudy.studyProgramDescription];
  }
});