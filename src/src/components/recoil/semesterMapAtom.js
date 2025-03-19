import { atom, selector } from 'recoil';
import { cisIdListSelector } from './cisIdListSelector';
import { studyPlanAtom } from './studyPlanAtom';
import { createSemesterMap } from '../helpers/createSemesterMap';

// Base atom to store the semester map
export const semesterMapAtom = atom({
  key: 'semesterMapAtom',
  default: {},
});

// Selector to compute the semester map
export const semesterMapSelector = selector({
  key: 'semesterMapSelector',
  get: ({get}) => {
    const cisIdList = get(cisIdListSelector);
    const studyPlan = get(studyPlanAtom);
    
    if (!cisIdList || !studyPlan || !studyPlan.allPlans) {
      return {};
    }

    return createSemesterMap(cisIdList, studyPlan.allPlans);
  }
});