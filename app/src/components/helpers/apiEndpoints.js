// Base URLs and endpoint builders for the university and SHSG APIs.
import { config } from "../../config";

export const UNISG_API = config.unisgApiBase;
export const SHSG_API = config.shsgApiBase;

export const catalogUrl = (cisId) =>
  `${UNISG_API}/EventApi/CourseInformationSheets/myLatestPublishedPossiblebyTerm/${cisId}`;
export const myCoursesUrl = (termId) =>
  `${UNISG_API}/EventApi/MyCourses/byTerm/${termId}`;
export const termsUrl = () => `${UNISG_API}/EventApi/CisTermAndPhaseInformations`;
