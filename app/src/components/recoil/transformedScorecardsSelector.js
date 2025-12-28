/**
 * @deprecated This file is unused and scheduled for removal.
 * Functionality migrated to unified state management system.
 * Last checked: December 2024
 */

// transformedScorecardsSelector.js //

// Data Format:  object where semesters are keys and values are arrays of course objects.

import { selector } from 'recoil';
import { scorecardDataState } from './scorecardsAllRawAtom';
import { transformScorecard } from '../helpers/transformScorecard';

export const transformedScorecardsSelector = selector({
  key: 'transformedScorecardsSelector',
  get: ({get}) => {
    const scorecardData = get(scorecardDataState);
    
    if (!scorecardData.isLoaded || !scorecardData.rawScorecards) {
      return {};
    }

    // Transform each program's scorecard
    return Object.entries(scorecardData.rawScorecards).reduce((acc, [programId, rawData]) => {
      acc[programId] = transformScorecard(rawData); //  returns n object where semesters are keys and values are arrays of course objects.
      return acc;
    }, {});
  }
});