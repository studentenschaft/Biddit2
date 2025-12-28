/**
 * CourseDetailsList.jsx
 *
 * Expanded course details view for a selected semester.
 * Shows course name, type, credits, and grade in a list format.
 */

import React from 'react';
import { LockClosed } from '../../../leftCol/bottomRow/LockClosed';
import {
  useCurrentSemester,
  removeSpacesFromSemesterName,
  sortCoursesByType,
  filterCoursesForSemester,
} from '../../../helpers/studyOverviewHelpers';

const CourseDetailsList = ({ courses, selectedSemester, hoveredCourse }) => {
  const currentSemester = useCurrentSemester();
  const filteredCourses = filterCoursesForSemester(
    courses || [],
    selectedSemester,
    currentSemester
  );

  const sortedCourses = sortCoursesByType(filteredCourses);

  const isHovered = (course) =>
    hoveredCourse &&
    hoveredCourse.name === course.name &&
    hoveredCourse.type === course.type;

  return (
    <div className="mt-4">
      <div className="py-2 pl-2 text-l font-bold bg-gray-100 rounded">
        Overview {removeSpacesFromSemesterName(selectedSemester)}
      </div>
      <div className="mt-2">
        {sortedCourses.map((course, idx) => {
          const isEnriched = course.isEnriched !== false;

          return (
            <div
              key={idx}
              className={`px-4 py-2 rounded grid grid-cols-10 gap-4 text-sm
                ${isHovered(course) ? "bg-gray-200" : ""}
                ${!isEnriched ? "bg-gray-50" : ""}
                transition-colors duration-200`}
            >
              <div
                className={`col-span-4 font-semibold truncate ${
                  !isEnriched ? "text-gray-500" : ""
                }`}
              >
                {course.name}
                {!isEnriched && (
                  <span className="ml-2 text-xs text-gray-500 animate-pulse">
                    Loading...
                  </span>
                )}
              </div>
              <div className="col-span-3 truncate">
                {course.type.replace("-wishlist", "")}
                {course.type.endsWith("-wishlist") && (
                  <span className="ml-1 text-orange-500 inline-flex items-center">
                    <LockClosed clg="w-3 h-3" />
                  </span>
                )}
              </div>
              <div className="text-center">{course.credits} ECTS</div>
              <div className="text-center col-span-2">
                {typeof course.grade === "number"
                  ? course.grade.toFixed(2)
                  : "N/A"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CourseDetailsList;
