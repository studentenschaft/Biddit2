// LockOpen.jsx //

import PropTypes from "prop-types";
import { useRecoilValue, useRecoilState } from "recoil";
import { authTokenState } from "../../recoil/authAtom";
import { selectedSemesterIndexAtom, selectedSemesterAtom } from "../../recoil/selectedSemesterAtom";

import { useCourseSelection } from "../../helpers/useCourseSelection";

import { selectedCourseIdsAtom } from "../../recoil/selectedCourseIdsAtom";
/**
 * LockOpen Component
 * Renders an open lock icon that toggles a course in or out of the user’s study plan
 */
export default function LockOpen({ clg, event }) {
  // Recoil states (NO LOCAL STATE)
  const authToken = useRecoilValue(authTokenState);
  const index = useRecoilValue(selectedSemesterIndexAtom) + 1;
  const selectedSemesterState = useRecoilValue(selectedSemesterAtom);

  const [selectedCourseIds, setSelectedCourseIds] = useRecoilState(
    selectedCourseIdsAtom
  );

  const { addOrRemoveCourse } = useCourseSelection({
    selectedCourseIds,
    setSelectedCourseIds,
    selectedSemesterShortName: selectedSemesterState?.shortName || selectedSemesterState || "",
    index,
    authToken,
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={
        clg + " hover:text-red-600 transition duration-500 ease-in-out"
      }
      onMouseDown={(e) => {
        e.preventDefault();
        event
          ? addOrRemoveCourse(event)
          : console.log("no event to lock/unlock");
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

LockOpen.propTypes = {
  clg: PropTypes.string.isRequired,
  event: PropTypes.object,
};

export { LockOpen };
