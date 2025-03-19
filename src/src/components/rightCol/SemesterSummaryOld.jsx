import { useRecoilValue } from 'recoil';
import { authTokenState } from '../recoil/authAtom';
import { getStudyPlan } from '../helpers/api';
import { useState } from 'react';
import { errorHandlingService } from '../errorHandling/ErrorHandlingService';

const SemesterSummary = () => {
  const authToken = useRecoilValue(authTokenState);
  const [studyPlanData, setStudyPlanData] = useState(null);

  const fetchStudyPlan = async () => {
    if (!authToken) {
      console.error("No auth token available");
      return;
    }
    try {
      const data = await getStudyPlan(authToken);
      setStudyPlanData(data);
      console.log("Study Plan Data:", data);
    } catch (error) {
      console.error("Error fetching study plan:", error);
      errorHandlingService.handleError(error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Semester Summary</h2>
      <div className="space-y-3">
        <p>Current Semester: Fall 2024</p>

        {/* Fetch Study Plan Button - FOR DEBUGGING AND DEV ONLY TEMPORARILY */}
        <button
          onClick={fetchStudyPlan}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Fetch Study Plan (FOR DEV)
        </button>
        {studyPlanData && (
          <pre className="mt-4 bg-gray-100 p-2 rounded">
            {JSON.stringify(studyPlanData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default SemesterSummary;