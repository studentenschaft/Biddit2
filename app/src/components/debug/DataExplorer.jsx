/**
 * DataExplorer.jsx
 * 
 * Step-by-step data exploration component to understand what data is available
 * from scorecardDataState + unifiedCourseData for building transcript/study overview
 */

import { useState } from "react";
import { useRecoilValue } from "recoil";

// Import the key atoms we need to explore
import { unifiedCourseDataState } from "../recoil/unifiedCourseDataAtom";
import { scorecardDataState } from "../recoil/scorecardsAllRawAtom";
import { authTokenState } from "../recoil/authAtom";

// Import controlled fetching hook for testing
import { useScorecardFetching } from "../helpers/useScorecardFetching";

const DataExplorer = () => {
  const [selectedDataSource, setSelectedDataSource] = useState("scorecardData");
  const [expandedKeys, setExpandedKeys] = useState(new Set());

  // Get the actual data from atoms
  const scorecardData = useRecoilValue(scorecardDataState);
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const authToken = useRecoilValue(authTokenState);
  
  // 🧪 TEST: Controlled scorecard fetching hook
  const scorecardFetching = useScorecardFetching();

  const dataSources = {
    scorecardData: {
      label: "📊 Scorecard Data (for Transcript)",
      data: scorecardData,
      description: "Raw scorecard/transcript data from university backend"
    },
    unifiedCourseData: {
      label: "🎯 Unified Course Data (for Study Overview)",
      data: unifiedCourseData,
      description: "Unified course data managed by EventListContainer"
    }
  };

  const selectedSource = dataSources[selectedDataSource];

  // Toggle expansion of nested objects
  const toggleExpanded = (key) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  // Render data with collapsible structure
  const renderData = (data, path = "", level = 0) => {
    if (data === null || data === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
      return (
        <span className={`${typeof data === "string" ? "text-green-600" : typeof data === "number" ? "text-blue-600" : "text-purple-600"}`}>
          {JSON.stringify(data)}
        </span>
      );
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <span className="text-gray-400 italic">[]</span>;
      }

      const isExpanded = expandedKeys.has(path);
      return (
        <div>
          <button 
            onClick={() => toggleExpanded(path)}
            className="text-blue-700 hover:text-blue-900 font-mono"
          >
            {isExpanded ? "▼" : "▶"} Array[{data.length}]
          </button>
          {isExpanded && (
            <div className="ml-4 border-l-2 border-gray-200 pl-2 mt-2">
              {data.slice(0, 3).map((item, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-600 font-mono">[{index}]: </span>
                  {renderData(item, `${path}[${index}]`, level + 1)}
                </div>
              ))}
              {data.length > 3 && (
                <div className="text-gray-500 italic">... and {data.length - 3} more items</div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (typeof data === "object") {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        return <span className="text-gray-400 italic">{"{}"}</span>;
      }

      const isExpanded = expandedKeys.has(path);
      return (
        <div>
          <button 
            onClick={() => toggleExpanded(path)}
            className="text-purple-700 hover:text-purple-900 font-mono"
          >
            {isExpanded ? "▼" : "▶"} Object{"{"}
            {keys.length}
            {"}"}
          </button>
          {isExpanded && (
            <div className="ml-4 border-l-2 border-gray-200 pl-2 mt-2">
              {keys.slice(0, 10).map((key) => (
                <div key={key} className="mb-2">
                  <span className="text-gray-700 font-mono font-semibold">{key}: </span>
                  {renderData(data[key], `${path}.${key}`, level + 1)}
                </div>
              ))}
              {keys.length > 10 && (
                <div className="text-gray-500 italic">... and {keys.length - 10} more properties</div>
              )}
            </div>
          )}
        </div>
      );
    }

    return <span className="text-red-500">Unknown type: {typeof data}</span>;
  };

  // Provide data insights
  const getDataInsights = (data) => {
    if (!data) return ["⚠️ No data available"];

    const insights = [];
    
    if (selectedDataSource === "scorecardData") {
      insights.push(`📚 Loaded: ${data.isLoaded ? "✅ Yes" : "❌ No"}`);
      if (data.rawScorecards) {
        const programs = Object.keys(data.rawScorecards);
        insights.push(`🎓 Programs: ${programs.length > 0 ? programs.join(", ") : "None"}`);
      }
      if (data.transformedScorecard) {
        insights.push(`📊 Transformed data available`);
      }
    } else if (selectedDataSource === "unifiedCourseData") {
      if (data.semesters) {
        const semesterNames = Object.keys(data.semesters);
        insights.push(`📅 Semesters: ${semesterNames.length > 0 ? semesterNames.join(", ") : "None"}`);
      }
      insights.push(`🎯 Selected: ${data.selectedSemester || "None"}`);
      insights.push(`📈 Latest valid term: ${data.latestValidTerm || "None"}`);
      if (data.studyPlan) {
        insights.push(`📋 Study plan available`);
      }
    }

    return insights;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white border-b">
        <h2 className="text-lg font-bold text-purple-800 mb-2">🔬 Data Explorer</h2>
        <p className="text-sm text-gray-600 mb-4">
          Explore available data to understand what we can use for transcript and study overview components
        </p>

        {/* Data Source Selector */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(dataSources).map(([key, source]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedDataSource(key);
                setExpandedKeys(new Set()); // Reset expansion when switching
              }}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedDataSource === key
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {source.label}
            </button>
          ))}
          
          {/* Manual Fetch Button */}
          <button
            onClick={async () => {
              if (!authToken) {
                alert('No auth token available');
                return;
              }
              console.log('🧪 Manual fetch triggered');
              const result = await scorecardFetching.fetchAll(authToken);
              if (result.success) {
                alert('Scorecard data fetched successfully!');
              } else {
                alert(`Fetch failed: ${result.error}`);
              }
            }}
            disabled={scorecardFetching.isFetchingScorecards || scorecardFetching.isFetchingEnrollments}
            className="px-4 py-2 bg-green-600 text-white rounded-lg border border-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {scorecardFetching.isFetchingScorecards || scorecardFetching.isFetchingEnrollments 
              ? "⏳ Fetching..." 
              : "🔄 Manual Fetch Scorecards"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Insights Panel */}
        <div className="w-1/3 p-4 border-r bg-white overflow-y-auto">
          <h3 className="font-semibold mb-3">💡 Quick Insights</h3>
          
          <div className="space-y-2 mb-6">
            {getDataInsights(selectedSource.data).map((insight, index) => (
              <div key={index} className="text-sm bg-blue-50 p-2 rounded">
                {insight}
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-600">
            <p className="mb-2"><strong>Purpose:</strong></p>
            <p className="mb-4">{selectedSource.description}</p>
            
            {selectedDataSource === "scorecardData" && (
              <div className="bg-yellow-50 p-3 rounded">
                <p className="font-semibold text-yellow-800">For Transcript:</p>
                <p className="text-yellow-700">We need completed courses, grades, credits, and semester information.</p>
              </div>
            )}
            
            {selectedDataSource === "unifiedCourseData" && (
              <div className="bg-green-50 p-3 rounded">
                <p className="font-semibold text-green-800">For Study Overview:</p>
                <p className="text-green-700">We need selected courses, study plan requirements, and progress tracking.</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Panel */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-4">
            <h3 className="font-semibold mb-3">🗂️ Data Structure</h3>
            
            {selectedSource.data ? (
              <div className="font-mono text-sm">
                {renderData(selectedSource.data, selectedDataSource, 0)}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p>⚠️ No data available</p>
                <p className="text-sm mt-2">
                  The atom might not be initialized yet or there might be a loading issue.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="p-4 bg-gray-800 text-white text-sm">
        <div className="flex justify-between items-center">
          <div>
            📋 Exploring: <strong>{selectedSource.label}</strong>
          </div>
          <div className="text-xs">
            💡 Click on objects/arrays to expand and explore the data structure
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExplorer;