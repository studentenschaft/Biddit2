import { atom } from 'recoil';

export const studyPlanAtom = atom({
  key: 'studyPlanAtom',
  default: {
    currentPlan: null,
    allPlans: [],
    isLoading: true,
    error: null
  }
});