import { atom } from 'recoil';

export const studyOverviewState = atom({
  key: 'studyOverviewState',
  default: {
    scorecards: {},
    isLoaded: false,
    loading: false,
  },
});