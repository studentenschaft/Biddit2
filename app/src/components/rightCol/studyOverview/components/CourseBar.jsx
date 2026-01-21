/**
 * CourseBar.jsx
 *
 * Visual course representation with color coding for study overview.
 * Shows course as a proportionally-sized colored bar based on credits.
 */

import React from 'react';
import { getTypeColor } from '../../../helpers/studyOverviewHelpers';

const CourseBar = ({ course, setHoveredCourse, maxSemesterCredits }) => {
  const isEnriched = course.isEnriched !== false;

  return (
    <div
      className={`h-full m-0.5 md:m-1 rounded flex items-center justify-center text-white
        ${getTypeColor(course)}
        transition-all duration-200
        hover:shadow-lg hover:scale-y-105
        ${!isEnriched ? "animate-pulse opacity-70" : ""}`}
      style={{
        width: `${(course.credits / maxSemesterCredits) * 100}%`,
        minWidth: "0.25rem",
      }}
      onMouseEnter={() => setHoveredCourse(course)}
      onMouseLeave={() => setHoveredCourse(null)}
      title={!isEnriched ? "Loading course details..." : course.name}
    />
  );
};

export default CourseBar;
