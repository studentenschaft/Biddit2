import { useRecoilState, useRecoilValue } from 'recoil';
import { devModeState } from '../testing/devModeAtom';
import DegreeSelector from './DegreeSelector';
import { useRefreshMockData } from '../testing/useRefreshMockData';
import { selectedDegreeState } from '../testing/devModeSelectedDegreeAtom';
import { useErrorHandler } from '../errorHandling/useErrorHandler';

const DevModeBanner = () => {
    const [devMode] = useRecoilState(devModeState);
    const selectedDegree = useRecoilValue(selectedDegreeState);
    const refreshMockData = useRefreshMockData();
    const handleError = useErrorHandler();
  
    if (!devMode) return null;

    const throwTestError = () => {
      try {
        throw new Error("This is a test error from DEV MODE");
      } catch (error) {
        handleError(error);
      }
    };
  
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white p-2 flex justify-between items-center">
        <span className="font-bold">DEV MODE</span>
        <DegreeSelector />
        <button 
          className="bg-white text-red-600 px-2 py-1 rounded mr-2"
          onClick={() => refreshMockData(selectedDegree)}
          disabled={!selectedDegree}
        >
          Refresh Data
        </button>
        <button 
          className="bg-white text-red-600 px-2 py-1 rounded"
          onClick={throwTestError}
        >
          Throw Error
        </button>
      </div>
    );
  };

export default DevModeBanner;