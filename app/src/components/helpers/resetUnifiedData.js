/**
 * Helper function to reset unified academic data
 * Use this to force re-initialization with the new comprehensive logic
 */

import { useSetRecoilState } from 'recoil';
import { unifiedAcademicDataState, initializedProgramsState } from '../recoil/unifiedAcademicDataAtom';

export const useResetUnifiedData = () => {
  const setUnifiedAcademicData = useSetRecoilState(unifiedAcademicDataState);
  const setInitializedPrograms = useSetRecoilState(initializedProgramsState);

  const resetData = () => {
    console.log('🔄 Resetting unified academic data...');
    
    setUnifiedAcademicData({
      programs: {},
      currentProgram: null,
      initialization: {
        isLoading: false,
        isInitialized: false,
        error: null,
        lastInitialized: null
      }
    });
    
    setInitializedPrograms(new Set());
    
    console.log('✅ Unified academic data reset complete');
  };

  return resetData;
};