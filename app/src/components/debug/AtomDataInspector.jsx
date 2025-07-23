/**
 * AtomDataInspector.jsx
 * 
 * Real-time JSON inspector for all EventListContainer-related atoms
 * Shows live updates of atom states for debugging data flow issues
 */

import { useState, useEffect } from "react";
import { useRecoilValue } from "recoil";

// All the atoms that EventListContainer and related components use
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
import { authTokenState } from "../recoil/authAtom";
import { studyPlanAtom } from "../recoil/studyPlanAtom";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";
import { currentEnrollmentsState } from "../recoil/currentEnrollmentsAtom";
import { unifiedAcademicDataState } from "../recoil/unifiedAcademicDataAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";

// EventListContainer specific atoms
import { selectionOptionsState } from "../recoil/selectionOptionsAtom";
import { selectedTabAtom } from "../recoil/selectedTabAtom";

// Import minimal scorecard access hook (read-only, no side effects)
import { useScorecardAccess } from "../helpers/useScorecardAccess";

// Import the new unified selectors
import { transcriptDataSelector } from "../recoil/transcriptDataSelector";
import { studyOverviewDataSelector } from "../recoil/studyOverviewDataSelector";
import { unifiedAcademicDataSelector } from "../recoil/unifiedAcademicDataSelector";

// Try to import more atoms that might be relevant
let additionalAtoms = {};
try {
  additionalAtoms = {
    // Add more atoms as we discover them
  };
} catch (e) {
  console.log("Some optional atoms not available:", e);
}

const AtomDataInspector = () => {
  const [selectedAtom, setSelectedAtom] = useState("unifiedCourseData");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 📊 TEST: Minimal scorecard data access (read-only, no fetching)
  const scorecardAccess = useScorecardAccess();

  // Read all the atoms with EventListContainer usage metadata
  const atomData = {
    // ✅ DIRECTLY USED by EventListContainer
    unifiedCourseData: useRecoilValue(unifiedCourseDataState),
    authToken: useRecoilValue(authTokenState),
    selectionOptions: useRecoilValue(selectionOptionsState),
    selectedTab: useRecoilValue(selectedTabAtom),
    
    // 🟡 USED BY EventListContainer's DATA MANAGERS
    currentEnrollments: useRecoilValue(currentEnrollmentsState),
    cisIdList: useRecoilValue(cisIdListSelector),
    
    // 🔴 NOT USED by EventListContainer (Legacy/Other components)
    scorecardData: useRecoilValue(scorecardDataState),
    studyPlan: useRecoilValue(studyPlanAtom),
    localSelectedCourses: useRecoilValue(localSelectedCoursesSemKeyState),
    unifiedAcademicDataLegacy: useRecoilValue(unifiedAcademicDataState),
    
    // 🆕 NEW UNIFIED SELECTORS
    transcriptData: useRecoilValue(transcriptDataSelector),
    studyOverviewData: useRecoilValue(studyOverviewDataSelector),
    unifiedAcademicData: useRecoilValue(unifiedAcademicDataSelector),
    
    ...additionalAtoms
  };

  // Categorize atoms by EventListContainer usage
  const atomCategories = {
    "✅ EventListContainer Direct": ["unifiedCourseData", "authToken", "selectionOptions", "selectedTab"],
    "🟡 EventListContainer Data Managers": ["currentEnrollments", "cisIdList"],
    "🔴 Legacy/Other Components": ["scorecardData", "studyPlan", "localSelectedCourses", "unifiedAcademicDataLegacy"],
    "🆕 New Unified Selectors": ["transcriptData", "studyOverviewData", "unifiedAcademicData"]
  };

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Get selected atom data
  const selectedData = atomData[selectedAtom];

  // Helper to format JSON nicely
  const formatJSON = (data) => {
    try {
      return JSON.stringify(data, (key, value) => {
        // Handle special cases
        if (value instanceof Set) {
          return `Set(${Array.from(value).join(', ')})`;
        }
        if (value instanceof Map) {
          return `Map(${JSON.stringify(Object.fromEntries(value))})`;
        }
        // Truncate very long strings
        if (typeof value === 'string' && value.length > 200) {
          return value.substring(0, 200) + '... (truncated)';
        }
        return value;
      }, 2);
    } catch (e) {
      return `Error formatting: ${e.message}`;
    }
  };

  // Count non-empty properties
  const getDataSummary = (data) => {
    if (!data) return "null/undefined";
    if (typeof data === "object") {
      const keys = Object.keys(data);
      const nonEmptyKeys = keys.filter(key => {
        const value = data[key];
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
        return value !== null && value !== undefined && value !== "";
      });
      return `${nonEmptyKeys.length}/${keys.length} non-empty properties`;
    }
    return typeof data;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">🔍 Atom Data Inspector</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="text-sm">Auto-refresh</span>
            </label>
            <div className="text-sm text-gray-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Atom Selector - Grouped by EventListContainer Usage */}
        <div className="space-y-3">
          {Object.entries(atomCategories).map(([categoryName, atomNames]) => (
            <div key={categoryName}>
              <div className="text-xs font-semibold mb-2 text-gray-600">
                {categoryName}
              </div>
              <div className="flex flex-wrap gap-2">
                {atomNames.map((atomName) => {
                  const data = atomData[atomName];
                  const isDirectUse = categoryName.includes("✅");
                  const isDataManager = categoryName.includes("🟡");
                  
                  return (
                    <button
                      key={atomName}
                      onClick={() => setSelectedAtom(atomName)}
                      className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                        selectedAtom === atomName
                          ? "bg-blue-500 text-white border-blue-500"
                          : isDirectUse
                          ? "bg-green-50 text-green-800 border-green-300 hover:bg-green-100"
                          : isDataManager
                          ? "bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100"
                          : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100"
                      }`}
                    >
                      <div className="font-medium">{atomName}</div>
                      <div className="text-xs opacity-75">
                        {getDataSummary(data)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Display */}
      <div className="flex-1 overflow-hidden flex">
        {/* Summary Panel */}
        <div className="w-1/3 p-4 border-r bg-white overflow-y-auto">
          <h3 className="font-semibold mb-3">📊 {selectedAtom} Summary</h3>
          
          {selectedData && typeof selectedData === "object" && (
            <div className="space-y-2">
              {Object.entries(selectedData).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <div className="font-medium text-gray-800">{key}:</div>
                  <div className="text-gray-600 ml-2">
                    {Array.isArray(value) 
                      ? `Array[${value.length}]`
                      : typeof value === "object" && value !== null
                      ? `Object{${Object.keys(value).length}}`
                      : String(value).substring(0, 50) + (String(value).length > 50 ? "..." : "")
                    }
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Key Insights */}
          <div className="mt-6">
            <h4 className="font-semibold mb-2">🔎 Key Insights</h4>
            <div className="text-xs space-y-1 text-gray-600">
              {selectedAtom === "unifiedCourseData" && (
                <>
                  <div>• Semesters: {Object.keys(selectedData?.semesters || {}).join(", ")}</div>
                  <div>• Selected: {selectedData?.selectedSemester || "none"}</div>
                  <div>• Latest Valid: {selectedData?.latestValidTerm || "none"}</div>
                </>
              )}
              {selectedAtom === "scorecardData" && (
                <>
                  <div>• Loaded: {selectedData?.isLoaded ? "✅" : "❌"}</div>
                  <div>• Programs: {Object.keys(selectedData?.rawScorecards || {}).join(", ")}</div>
                </>
              )}
              {selectedAtom === "localSelectedCourses" && (
                <>
                  <div>• Semesters with selections: {Object.keys(selectedData || {}).join(", ")}</div>
                  <div>• Total courses: {Object.values(selectedData || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0)}</div>
                  <div className="text-red-600">• ⚠️ Legacy atom - EventListContainer uses unifiedCourseData.selectedIds instead</div>
                </>
              )}
              {selectedAtom === "studyPlan" && (
                <>
                  <div>• Plans: {selectedData?.allPlans?.length || 0}</div>
                  <div>• Loading: {selectedData?.isLoading ? "✅" : "❌"}</div>
                  <div className="text-red-600">• ⚠️ Legacy atom - EventListContainer uses unifiedCourseData.studyPlan instead</div>
                </>
              )}
              {selectedAtom === "currentEnrollments" && (
                <>
                  <div>• Has data: {selectedData ? "✅" : "❌"}</div>
                  <div>• Info count: {selectedData?.enrollmentInfos?.length || 0}</div>
                  <div className="text-yellow-600">• 🔄 Used by EventListContainer data managers</div>
                </>
              )}
              {selectedAtom === "authToken" && (
                <>
                  <div>• Has token: {selectedData ? "✅" : "❌"}</div>
                  <div>• Token length: {selectedData?.length || 0} chars</div>
                  <div className="text-green-600">• ✅ Directly used by EventListContainer</div>
                </>
              )}
              {selectedAtom === "selectionOptions" && (
                <>
                  <div>• Filter options available: {Object.keys(selectedData || {}).length}</div>
                  <div className="text-green-600">• ✅ Directly used by EventListContainer for filtering</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* JSON Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">📄 Raw JSON Data</h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(formatJSON(selectedData));
                  alert("Copied to clipboard!");
                }}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
              >
                Copy JSON
              </button>
            </div>
            
            <pre className="bg-gray-800 text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto max-h-full whitespace-pre-wrap">
              {formatJSON(selectedData)}
            </pre>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="p-2 bg-gray-800 text-white text-xs flex justify-between items-center">
        <div>
          🔴 Live Data Inspector - Monitoring {Object.keys(atomData).length} atoms
        </div>
        <div>
          Updates: {autoRefresh ? "🟢 Auto" : "🟡 Manual"}
        </div>
      </div>
    </div>
  );
};

export default AtomDataInspector;