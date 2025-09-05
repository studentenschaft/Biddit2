// GradeTranscript.jsx
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import LoadingText from "../common/LoadingText";
import { useCustomGrades } from "../helpers/useCustomGrades";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";
import { calculateCreditsAndGrades } from "../helpers/calculateGrades";
import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { useCourseSelection } from "../helpers/useCourseSelection";

/**
 * Helper to format numbers to two decimal places.
 * Returns "N/A" if the value is null or not a number.
 */
const formatNumber = (value, isGrade = false) => {
  if (value === null || isNaN(value)) return "-";
  if (isGrade) {
    return value.toFixed(2); // for grades, want e.g. 5.75
  }
  return value.toFixed(0); // ECTS are always full numbers
};

/**
 * Helper to determine background color based on completion status,
 * hierarchy level, and (optionally) whether the item is a placeholder.
 *
 * @param {boolean} isCompleted - Whether the item or any parent is complete.
 * @param {number} level - Hierarchy level (1 = main, 2 = sub, etc.).
 * @param {boolean} [isPlaceholder=false] - Whether the item is a placeholder.
 * @returns {string} - The Tailwind CSS class for the background color.
 */
const getBackgroundColor = (isCompleted, level, isPlaceholder = false) => {
  if (isCompleted) {
    if (level === 1) return "bg-green-200";
    if (level === 2) return "bg-green-100";
    return "bg-green-50";
  }
  if (isPlaceholder) return "bg-yellow-50";
  if (level === 1) return "bg-gray-200";
  if (level === 2) return "bg-gray-100";
  return "bg-white";
};

/**
 * CustomGradeInput component allows users to input and update custom grades.
 */
const CustomGradeInput = React.memo(({ initialValue, onUpdate }) => {
  const [inputValue, setInputValue] = useState(initialValue?.toString() || "");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputValue(initialValue?.toString() || "");
  }, [initialValue]);

  const handleChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  const clearValue = () => {
    setInputValue("");
    onUpdate(null);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
        e.target.blur();
        break;
      case "Escape":
        clearValue();
        e.target.blur();
        break;
      case "Delete":
      case "Backspace":
        if (e.target.value === "") clearValue();
        break;
      default:
        break;
    }
  };

  const validateAndUpdate = () => {
    const numericValue = parseFloat(inputValue);
    if (inputValue === "") onUpdate(null);
    else if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 6) {
      onUpdate(numericValue);
    } else {
      setInputValue(initialValue?.toString() || "");
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          validateAndUpdate();
        }}
        className={`w-12 h-6 text-right bg-gray-100 border-none text-sm px-1 rounded 
          ${isFocused ? "ring-1 ring-green-500" : ""} 
          ${inputValue ? "pr-5" : "pr-1"} 
          focus:outline-none focus:ring-1 focus:ring-green-500`}
        placeholder="-"
      />
      {inputValue && (
        <button
          onClick={clearValue}
          className="absolute right-1 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

CustomGradeInput.propTypes = {
  initialValue: PropTypes.number,
  onUpdate: PropTypes.func.isRequired,
};

// Set a display name for the memoized component
CustomGradeInput.displayName = "CustomGradeInput";

/**
 * GradeTranscript component displays the transcript of grades and allows users to input custom grades.
 *  * NOTE: To enable removal of saved (wishlisted) courses, we  require additional props:
 * semesterShortName, semesterIndex, authToken, selectedCourseIds, and setSelectedCourseIds.
 */
const GradeTranscript = ({
  scorecardDetails,
  semesterShortName,
  semesterIndex,
  authToken,
  selectedCourseIds,
  setSelectedCourseIds,
}) => {
  const [customGradeUpdate, setCustomGradeUpdate] = useState(0);
  const { getCustomGrade, updateCustomGrade } = useCustomGrades();

  // Initialize course selection hook for handling saved courses
  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds,
    selectedSemesterShortName: semesterShortName,
    index: semesterIndex,
    authToken,
  });

  /**
   * Handles changes to custom grade input.
   * Updates the custom grade if the input is valid.
   *
   * @param {string} identifier - The unique identifier for the course.
   * @param {string|number|null} value - The new grade value.
   */
  const handleCustomGradeChange = async (identifier, value) => {
    try {
      const newGrade =
        value === null || value === "" ? null : parseFloat(value);
      if (
        newGrade === null ||
        (!isNaN(newGrade) && newGrade >= 1 && newGrade <= 6)
      ) {
        await updateCustomGrade(identifier, newGrade);
        setCustomGradeUpdate((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error updating custom grade:", error);
      errorHandlingService.handleError(error);
    }
  };

  /**
   * Recursively renders transcript items (categories and courses).
   *
   * @param {Object} item - The transcript item.
   * @param {boolean} [parentCompleted=false] - Whether a parent category is complete.
   * @returns {JSX.Element|null} - The rendered transcript item.
   */
  const renderTranscriptItem = (item, parentCompleted = false) => {
    if (!item.isTitle) return null;

    // --- NEW: Determine if it's a thesis category with no child items (i.e., no actual submitted thesis) ---
    const descriptionLower = (item.description || "").toLowerCase();
    const isThesisCategory =
      descriptionLower.includes("thesis") &&
      descriptionLower.includes("(title in original language)");


    let childItems = item.items || [];
    // If it's a thesis category and currently has no child items, create a placeholder array
    if (isThesisCategory && childItems.length === 0) {
      childItems = [
        {
          isTitle: false,
          isPlaceholder: true,
          sumOfCredits: item.maxCredits || "0.00", // try to use parent's ECTS (to enable grade avg calculations)
          mark: null,
          shortName: "Thesis placeholder",
          description: "Thesis placeholder",
        },
      ];
    }

    // Calculate totals and averages for this category
    const {
      totalCredits,
      gradeSum,
      filteredCredits,
      customGradeSum,
      customEctsSum,
    } = calculateCreditsAndGrades(
      isThesisCategory ? childItems : item.items, // if is thesisCategory, then use newly created placeholder, else use item.items
      getCustomGrade
    );

    const avgGrade = filteredCredits > 0 ? gradeSum / filteredCredits : null;
    const customAvgGrade =
      customEctsSum > 0 ? customGradeSum / customEctsSum : null;
    const level = item.hierarchyLevel; // e.g. 1 = main, 2 = sub

    // Determine if this category is complete
    const ownCompleted = totalCredits >= parseFloat(item.maxCredits);
    const isCompleted = parentCompleted || ownCompleted;
    const bgColor = getBackgroundColor(isCompleted, level);

    return (
      <div className={`mb-1 ${bgColor}`}>
        {/* Category header */}
        <div
          className={`grid grid-cols-[3fr,repeat(5,1fr)] gap-2 items-center p-2 
              ${
                level === 1
                  ? "font-bold text-lg"
                  : level === 2
                  ? "font-semibold ml-4"
                  : "font-bold text-sm ml-8"
              }`}
        >
          <div>
            {item.description && item.description.trim()
              ? item.description
              : item.shortName}
          </div>
          <div className="text-right">
            {formatNumber(parseFloat(item.minCredits))} ECTS
          </div>
          <div className="text-right">
            {formatNumber(parseFloat(item.maxCredits))} ECTS
          </div>
          <div className="text-right">{formatNumber(totalCredits)} ECTS</div>
          <div className="text-right">{formatNumber(avgGrade, true)}</div>
          <div className="text-right">{formatNumber(customAvgGrade, true)}</div>
        </div>
        {/* Child items */}
        <div className="space-y-1">
          {childItems.map((subItem, index) => (
            <React.Fragment key={index}>
              {subItem.isTitle ? (
                renderTranscriptItem(subItem, isCompleted)
              ) : (
                <div
                  className={getBackgroundColor(
                    isCompleted,
                    level,
                    subItem.isPlaceholder
                  )}
                >
                  <div
                    className={`grid grid-cols-[3fr,repeat(5,1fr)] gap-2 items-center p-2 text-sm ml-12 
                      ${subItem.isWishlist ? "italic text-gray-600" : ""}`}
                  >
                    <div className="flex items-center">
                      {/* Render lock icon for saved courses; assigned ones are locked and non-removable */}
                      {subItem.isWishlist && (
                        subItem.isAssigned ? (
                          <span
                            className="mr-2"
                            title="Assigned by university backend — cannot remove here"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-4 h-4"
                              style={{ color: "#006625" }}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                              />
                            </svg>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              console.log('🔍 [GradeTranscript] Remove button clicked:', {
                                courseId: subItem.id || subItem.courseId,
                                courseName: subItem.shortName || subItem.description,
                                isCurrentlySelected: selectedCourseIds.includes(subItem.id) || selectedCourseIds.includes(subItem.courseId),
                                selectedCourseIds: selectedCourseIds
                              });
                              addOrRemoveCourse(subItem);
                            }}
                            className="mr-2 focus:outline-none"
                            title="Click to remove saved course"
                          >
                            <LockOpen clg="w-4 h-4 " />
                          </button>
                        )
                      )}
                      <span>
                        {subItem.description && subItem.description.trim()
                          ? subItem.description
                          : subItem.shortName}
                      </span>
                      {subItem.isPlaceholder && (
                        <span className="ml-2 text-xs">(Planned)</span>
                      )}
                    </div>
                    <div className="text-right"></div>
                    <div className="text-right"></div>
                    <div className="text-right">
                      {formatNumber(parseFloat(subItem.sumOfCredits))} ECTS
                    </div>
                    <div className="text-right">{subItem.mark || subItem.gradeText || "-"}</div>
                    <div className="text-right">
                      {subItem.gradeText && subItem.gradeText.toLowerCase().includes('p') ? (
                        // Don't show wish grade input for passed courses
                        <span className="text-gray-500 text-sm">-</span>
                      ) : (
                        <CustomGradeInput
                          key={`${subItem.shortName}-${customGradeUpdate}`}
                          initialValue={getCustomGrade(subItem.shortName)}
                          onUpdate={(value) =>
                            handleCustomGradeChange(subItem.shortName, value)
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // Calculate overall values for the transcript header (with null safety)
  const overallCalculations = React.useMemo(() => {
    if (!scorecardDetails?.items?.[0]?.items) {
      return {
        totalCredits: 0,
        gradeSum: 0,
        filteredCredits: 0,
        customGradeSum: 0,
        customEctsSum: 0,
        overallAvgGrade: null,
        overallCustomAvg: null
      };
    }
    
    const {
      totalCredits,
      gradeSum,
      filteredCredits,
      customGradeSum,
      customEctsSum,
    } = calculateCreditsAndGrades(
      scorecardDetails.items[0].items,
      getCustomGrade
    );
    
    const overallAvgGrade = filteredCredits > 0 ? gradeSum / filteredCredits : null;
    const overallCustomAvg = customEctsSum > 0 ? customGradeSum / customEctsSum : null;
    
    return {
      totalCredits,
      gradeSum,
      filteredCredits,
      customGradeSum,
      customEctsSum,
      overallAvgGrade,
      overallCustomAvg
    };
  }, [scorecardDetails, getCustomGrade]);
  
  const { overallAvgGrade, overallCustomAvg } = overallCalculations;

  return (
    <div className="p-4 bg-white">
      {scorecardDetails && scorecardDetails.items ? (
        <>
          {/* Main category header */}
          <h3 className="text-xl font-semibold mb-4 text-gray-700">
            {scorecardDetails.items[0]?.description || 'Academic Transcript'}
          </h3>
          <div className="grid grid-cols-[3fr,repeat(5,1fr)] gap-2 text-lg font-bold mb-4 text-green-700">
            <div className="text-right"></div>
            <div className="text-right">
              {formatNumber(parseFloat(scorecardDetails.items[0]?.minCredits || 0))}{" "}
              ECTS
            </div>
            <div className="text-right">
              {formatNumber(parseFloat(scorecardDetails.items[0]?.maxCredits || 0))}{" "}
              ECTS
            </div>
            <div className="text-right">
              {formatNumber(parseFloat(scorecardDetails.items[0]?.sumOfCredits || 0))}{" "}
              ECTS
            </div>
            <div className="text-right">
              {formatNumber(parseFloat(scorecardDetails.items[0]?.mark || 0), true)}
            </div>
            <div className="text-right">
              {formatNumber(overallCustomAvg, true)}
            </div>
          </div>
          <div className="space-y-2">
            {/* Table headers */}
            <div className="grid grid-cols-[3fr,repeat(5,1fr)] gap-2 font-bold text-sm text-gray-600 mb-2 p-2 bg-gray-200">
              <div></div>
              <div className="text-right">Min.</div>
              <div className="text-right">Max.</div>
              <div className="text-right">Earned</div>
              <div className="text-right">Real</div>
              <div className="text-right">Wish</div>
            </div>
            {(scorecardDetails.items[0]?.items || []).map((item, index) => (
              <div key={index}>{renderTranscriptItem(item)}</div>
            ))}
          </div>
        </>
      ) : (
        <LoadingText>Scorecard is loading...</LoadingText>
      )}
    </div>
  );
};

GradeTranscript.propTypes = {
  scorecardDetails: PropTypes.object.isRequired,
  semesterShortName: PropTypes.string.isRequired,
  semesterIndex: PropTypes.number.isRequired,
  authToken: PropTypes.string.isRequired,
  selectedCourseIds: PropTypes.array.isRequired,
  setSelectedCourseIds: PropTypes.func.isRequired,
};

// Set a display name for the main component
GradeTranscript.displayName = "GradeTranscript";

export default GradeTranscript;
