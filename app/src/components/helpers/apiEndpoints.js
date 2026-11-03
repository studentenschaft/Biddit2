// Base URLs and endpoint builders for the university and SHSG APIs.
export const UNISG_API = "https://integration.unisg.ch";
export const SHSG_API = "https://api.shsg.ch";

export const catalogUrl = (cisId) =>
  `${UNISG_API}/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`;
export const myCoursesUrl = (termId) =>
  `${UNISG_API}/EventApi/MyCourses/byTerm/${termId}`;
export const termsUrl = () => `${UNISG_API}/EventApi/CisTermAndPhaseInformations`;
