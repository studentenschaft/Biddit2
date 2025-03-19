import { atom } from 'recoil';

// Store raw official scorecard data (fetched once per session)
export const scorecardDataState = atom({
  key: 'scorecardDataState',
  default: {
    rawScorecards: {}, // Format: { programId: rawScoreCardData }
    isLoaded: false,
    loading: false,
    error: null,
    lastFetched: null
  },
});