import BIA_Scorecard from '../testing/mockData/Scorecard_BIA.json';
import BBWL_Scorecard from '../testing/mockData/Scorecard_BBWL.json';
import MBI_Scorecard from '../testing/mockData/Scorecard_MBI.json'

const mockScorecards = {
  BIA: BIA_Scorecard,
  BBWL: BBWL_Scorecard,
  MBI: MBI_Scorecard,
};

export const getMockScorecard = (degreeId) => {
  return mockScorecards[degreeId] || null;
};