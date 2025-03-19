import { selector } from 'recoil';
import { studyPlanAtom } from './studyPlanAtom';

export const studyPlanSelector = selector({
  key: 'studyPlanSelector',
  get: ({get}) => {
    const studyPlan = get(studyPlanAtom);
    if (studyPlan.isLoading) {
      throw new Promise((resolve) => {
        // This will suspend the component until studyPlan is loaded
        const checkLoading = setInterval(() => {
          if (!studyPlan.isLoading) {
            clearInterval(checkLoading);
            resolve();
          }
        }, 100);
      });
    }
    if (studyPlan.error) {
      throw studyPlan.error;
    }
    return studyPlan;
  }
});