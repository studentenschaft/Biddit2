import { useRecoilState, useRecoilValue } from "recoil";
import { devModeState } from "../testing/devModeAtom";
import DegreeSelector from "./DegreeSelector";
import { useRefreshMockData } from "../testing/useRefreshMockData";
import { selectedDegreeState } from "../testing/devModeSelectedDegreeAtom";
import { useErrorHandler } from "../errorHandling/useErrorHandler";
import { useState } from "react";

const DevModeBanner = () => {
  const [devMode] = useRecoilState(devModeState);
  const selectedDegree = useRecoilValue(selectedDegreeState);
  const refreshMockData = useRefreshMockData();
  const handleError = useErrorHandler();
  const [showMigration, setShowMigration] = useState(false);

  if (!devMode) return null;

  const throwTestError = () => {
    try {
      throw new Error("This is a test error from DEV MODE");
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <>
      {showMigration && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-screen overflow-auto">
            <button
              onClick={() => setShowMigration(false)}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center z-10"
            >
              ×
            </button>
          </div>
        </div>
      )}

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
          className="bg-white text-red-600 px-2 py-1 rounded mr-2"
          onClick={() => setShowMigration(true)}
        >
          Migration Manager
        </button>
        <button
          className="bg-white text-red-600 px-2 py-1 rounded"
          onClick={throwTestError}
        >
          Throw Error
        </button>
      </div>
    </>
  );
};

export default DevModeBanner;
