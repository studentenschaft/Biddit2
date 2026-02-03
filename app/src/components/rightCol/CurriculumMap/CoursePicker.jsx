/**
 * CoursePicker.jsx
 *
 * Sidebar component for adding courses to the Curriculum Map grid.
 * Features:
 * - Semester selector dropdown (future semesters only)
 * - Search input for filtering courses
 * - Draggable course cards
 *
 * Data source: unifiedCourseDataState.semesters[semKey].available
 */

import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useRecoilValue } from "recoil";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";
import { localSelectedCoursesSemKeyState } from "../../recoil/localSelectedCoursesSemKeyAtom";
import { curriculumPlanState, sortSemesters } from "../../recoil/curriculumPlanAtom";

/**
 * PickerCourseCard - A draggable course card in the picker
 */
const PickerCourseCard = ({ course, semesterKey }) => {
  const courseId = course.courseNumber || course.id;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `picker-${courseId}-${semesterKey}`,
      data: {
        type: "picker-course",
        course,
        semesterKey,
        courseId,
      },
    });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const creditsDisplay = course.credits
    ? (course.credits / 100).toFixed(course.credits % 100 === 0 ? 0 : 1)
    : "?";

  const displayName =
    course.shortName?.length > 35
      ? course.shortName.substring(0, 33) + "..."
      : course.shortName || courseId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white border border-stone-200 rounded px-2 py-1.5 text-xs cursor-grab hover:border-hsg-400 hover:shadow-sm transition-all select-none ${
        isDragging ? "opacity-50 cursor-grabbing" : ""
      }`}
      title={`${course.shortName}\n${creditsDisplay} ECTS\nDrag to add to grid`}
    >
      {/* Course name */}
      <div className="font-medium text-gray-900 leading-tight truncate">
        {displayName}
      </div>

      {/* Course details */}
      <div className="flex items-center justify-between mt-0.5 text-[10px] text-gray-500">
        <span>{creditsDisplay} ECTS</span>
        {course.classification && (
          <span className="truncate max-w-[80px]" title={course.classification}>
            {course.classification}
          </span>
        )}
      </div>
    </div>
  );
};

PickerCourseCard.propTypes = {
  course: PropTypes.shape({
    courseNumber: PropTypes.string,
    id: PropTypes.string,
    shortName: PropTypes.string,
    credits: PropTypes.number,
    classification: PropTypes.string,
  }).isRequired,
  semesterKey: PropTypes.string.isRequired,
};

/**
 * CoursePicker - Main sidebar component
 */
const CoursePicker = ({ futureSemesters = [] }) => {
  const unifiedCourseData = useRecoilValue(unifiedCourseDataState);
  const localSelectedCourses = useRecoilValue(localSelectedCoursesSemKeyState);
  const curriculumPlan = useRecoilValue(curriculumPlanState);

  const [selectedSemester, setSelectedSemester] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Get available semesters (only future ones with data)
  const availableSemesters = useMemo(() => {
    if (!unifiedCourseData.semesters) return [];

    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth();
    const isCurrentlyHS = currentMonth >= 8 || currentMonth <= 1;
    const currentSemYear =
      isCurrentlyHS && currentMonth <= 1 ? currentYear - 1 : currentYear;
    const currentSemKey = `${isCurrentlyHS ? "HS" : "FS"}${currentSemYear}`;

    // Get all semesters from data that are current or future
    const semestersWithData = Object.keys(unifiedCourseData.semesters).filter(
      (semKey) => {
        const semData = unifiedCourseData.semesters[semKey];
        return semData?.available?.length > 0;
      }
    );

    // Also include semesters passed as props (from curriculum map)
    const allSemesters = new Set([...semestersWithData, ...futureSemesters]);

    // Filter to current and future only
    return sortSemesters(Array.from(allSemesters)).filter((semKey) => {
      // Simple comparison: current and future semesters
      const semType = semKey.substring(0, 2);
      const semYear = parseInt(semKey.substring(2), 10);
      const currentType = isCurrentlyHS ? "HS" : "FS";

      if (semYear > currentSemYear) return true;
      if (semYear < currentSemYear) return false;
      // Same year
      if (semKey === currentSemKey) return true;
      if (semType === "HS" && currentType === "FS") return true;
      return false;
    });
  }, [unifiedCourseData.semesters, futureSemesters]);

  // Auto-select first available semester
  useMemo(() => {
    if (!selectedSemester && availableSemesters.length > 0) {
      setSelectedSemester(availableSemesters[0]);
    }
  }, [availableSemesters, selectedSemester]);

  // Get courses for selected semester
  const semesterCourses = useMemo(() => {
    if (!selectedSemester || !unifiedCourseData.semesters?.[selectedSemester]) {
      return [];
    }
    return unifiedCourseData.semesters[selectedSemester].available || [];
  }, [selectedSemester, unifiedCourseData.semesters]);

  // Get already-added course IDs for the selected semester
  const alreadyAddedIds = useMemo(() => {
    const ids = new Set();

    // From wishlist
    const wishlistCourses = localSelectedCourses[selectedSemester] || [];
    wishlistCourses.forEach((c) => {
      ids.add(c.id);
      ids.add(c.courseNumber);
    });

    // From curriculum plan
    const planItems = curriculumPlan.plannedItems?.[selectedSemester] || [];
    planItems.forEach((item) => {
      if (item.type === "course") {
        ids.add(item.courseId);
      }
    });

    return ids;
  }, [selectedSemester, localSelectedCourses, curriculumPlan.plannedItems]);

  // Filter courses based on search and already-added
  const filteredCourses = useMemo(() => {
    let courses = semesterCourses;

    // Exclude already-added courses
    courses = courses.filter((c) => {
      const courseId = c.courseNumber || c.id;
      return !alreadyAddedIds.has(courseId);
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      courses = courses.filter(
        (c) =>
          c.shortName?.toLowerCase().includes(query) ||
          c.courseNumber?.toLowerCase().includes(query) ||
          c.classification?.toLowerCase().includes(query)
      );
    }

    // Limit to 50 for performance
    return courses.slice(0, 50);
  }, [semesterCourses, searchQuery, alreadyAddedIds]);

  const totalAvailable = semesterCourses.filter(
    (c) => !alreadyAddedIds.has(c.courseNumber || c.id)
  ).length;

  return (
    <div className="w-64 flex-shrink-0 border-l border-stone-200 bg-stone-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-stone-200 bg-white">
        <h3 className="font-semibold text-sm text-gray-800 mb-2">
          Add Courses
        </h3>

        {/* Semester selector */}
        <select
          value={selectedSemester}
          onChange={(e) => {
            setSelectedSemester(e.target.value);
            setSearchQuery("");
          }}
          className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-hsg-500 focus:border-hsg-500"
        >
          {availableSemesters.length === 0 ? (
            <option value="">No semesters available</option>
          ) : (
            availableSemesters.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))
          )}
        </select>

        {/* Search input */}
        <div className="relative mt-2">
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-2 py-1.5 pl-7 text-sm border border-stone-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-hsg-500 focus:border-hsg-500"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            🔍
          </span>
        </div>
      </div>

      {/* Course list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {availableSemesters.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No course data available.</p>
            <p className="text-xs mt-1">
              Select a semester in the main view to load courses.
            </p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchQuery ? (
              <p>No courses match &quot;{searchQuery}&quot;</p>
            ) : totalAvailable === 0 ? (
              <p>All courses already added for {selectedSemester}</p>
            ) : (
              <p>No courses available</p>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => (
            <PickerCourseCard
              key={course.courseNumber || course.id}
              course={course}
              semesterKey={selectedSemester}
            />
          ))
        )}
      </div>

      {/* Footer with count */}
      <div className="p-2 border-t border-stone-200 bg-white text-[10px] text-gray-500 text-center">
        {filteredCourses.length < totalAvailable
          ? `Showing ${filteredCourses.length} of ${totalAvailable}`
          : `${totalAvailable} courses available`}
        {filteredCourses.length === 50 && totalAvailable > 50 && (
          <span className="block">Use search to find more</span>
        )}
      </div>
    </div>
  );
};

CoursePicker.propTypes = {
  futureSemesters: PropTypes.arrayOf(PropTypes.string),
};

export default CoursePicker;
