import { atom } from "recoil";

/**
 * The semester whose card opened Course Details, when the caller knows it
 * (the curriculum map); null otherwise. A projected semester's course carries
 * its reference semester's cisId, so the course alone cannot say which
 * semester it was opened for. `useOpenCourseDetails` sets it on every open.
 */
export const courseDetailsSemesterAtom = atom({
  key: "courseDetailsSemester",
  default: null,
});
