import React from "react";
import { useRecoilValue } from "recoil";
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { useUnifiedCourseData } from "../helpers/useUnifiedCourseData";

/**
 * Debug component to check unified course data structure
 */
export function UnifiedDataDebug() {
  const unifiedCourseDataFromAtom = useRecoilValue(unifiedCourseDataState);
  const { courseData: unifiedCourseDataFromHook } = useUnifiedCourseData();

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="font-bold text-yellow-800 mb-3">
        Unified Data Structure Debug
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-yellow-700">
            From Atom (unifiedCourseDataState):
          </h4>
          <div className="text-xs bg-white p-2 rounded border max-h-60 overflow-auto">
            <pre>{JSON.stringify(unifiedCourseDataFromAtom, null, 2)}</pre>
          </div>
          <div className="mt-2 text-sm">
            <div>
              Has semesters:{" "}
              {unifiedCourseDataFromAtom?.semesters ? "Yes" : "No"}
            </div>
            <div>
              Semester count:{" "}
              {Object.keys(unifiedCourseDataFromAtom?.semesters || {}).length}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-yellow-700">
            From Hook (useUnifiedCourseData):
          </h4>
          <div className="text-xs bg-white p-2 rounded border max-h-60 overflow-auto">
            <pre>{JSON.stringify(unifiedCourseDataFromHook, null, 2)}</pre>
          </div>
          <div className="mt-2 text-sm">
            <div>
              Is object:{" "}
              {typeof unifiedCourseDataFromHook === "object" ? "Yes" : "No"}
            </div>
            <div>
              Semester count:{" "}
              {Object.keys(unifiedCourseDataFromHook || {}).length}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
        <h5 className="font-semibold text-red-700">
          Structure Mismatch Analysis:
        </h5>
        <div className="text-sm text-red-600">
          <div>
            Atom expects: courseData.semesters[semesterName] = {`{data}`}
          </div>
          <div>Hook uses: courseData[semesterName] = {`{data}`}</div>
          <div className="mt-2 font-medium">
            This mismatch explains why the MigrationController doesn't see
            unified data!
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnifiedDataDebug;
