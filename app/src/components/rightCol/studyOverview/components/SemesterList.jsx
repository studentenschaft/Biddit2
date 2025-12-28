/**
 * SemesterList.jsx
 *
 * Renders list of semester rows for the study overview.
 */

import React from 'react';
import SemesterRow from './SemesterRow';

const SemesterList = ({
  sortedSemesters,
  selectedSemester,
  setSelectedSemester,
  setHoveredCourse,
  maxSemesterCredits,
}) => {
  return (
    <>
      {sortedSemesters.map(([semester, courses]) => (
        <SemesterRow
          key={semester}
          semester={semester}
          courses={courses}
          selectedSemester={selectedSemester}
          setSelectedSemester={setSelectedSemester}
          setHoveredCourse={setHoveredCourse}
          maxSemesterCredits={maxSemesterCredits}
        />
      ))}
    </>
  );
};

export default SemesterList;
