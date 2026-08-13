/**
 * SemesterList.jsx
 *
 * Renders list of semester rows for the study overview.
 */

import PropTypes from 'prop-types';
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

SemesterList.propTypes = {
  sortedSemesters: PropTypes.array.isRequired,
  selectedSemester: PropTypes.string,
  setSelectedSemester: PropTypes.func,
  setHoveredCourse: PropTypes.func,
  maxSemesterCredits: PropTypes.number,
};

export default SemesterList;
