import { atom, selector } from "recoil";
import { authTokenState } from "./authAtom";
import { cisIdListSelector } from "./cisIdListSelector";
import { parseSemester } from "../helpers/transformScorecard";
import axios from "axios";

export const coursesRatedState = atom({
  key: "coursesRated",
  default: selector({
    key: "coursesRated/Default",
    get: async ({ get }) => {
      const token = get(authTokenState);
      try {
        const res = await axios.get(
          `https://api.shsg.ch/course-ratings/of-user`,
          {
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "EN",
              "API-Version": "1",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        return res.data;
      } catch (err) {
        console.error("Error fetching rated courses:", err);
        return [];
      }
    },
  }),
});

export const coursesTakenForRatingState = atom({
  key: "coursesTakenForRatings",
  default: selector({
    key: "coursesTakenForRatings/Default",
    get: async ({ get }) => {
      const token = get(authTokenState);
      const cisIdList = get(cisIdListSelector);
      const currentSemester = cisIdList.find(term => term.isCurrent)?.shortName;
      if (!currentSemester) {
        console.warn("No current semester found");
        return [];
      }

      try {
        // First get all available semesters and their TimeSegmentIds
        const semesterInfo = await axios.get(
          `https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations`,
          {
            headers: {
              "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
              "X-RequestedLanguage": "EN",
              "API-Version": "1",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // replace any data.shortname entries semester name formatting (e.g., SpSXX -> FSXX, AuSXX -> HSXX)
        semesterInfo.data = semesterInfo.data.map(semester => {
          const oldShortName = semester.shortName;
          const normalizedShortName = semester.shortName.replace(/SpS(\d{2})/, "FS$1").replace(/AuS(\d{2})/, "HS$1");
          return {
            ...semester,
            shortName: normalizedShortName,
            oldShortName: oldShortName,
          };
        });

        // Filter for ratable semesters and map to TimeSegmentIds
        const ratableSemesters = semesterInfo.data
          .filter(semester => isSemesterRatable(semester.shortName, currentSemester))
          .reduce((acc, semester) => {
            acc[semester.shortName] = semester.timeSegmentId;
            return acc;
          }, {});

        async function loadRatingCourses(semesterName, timeSegmentId) {
          try {
            const res = await axios.get(
              `https://integration.unisg.ch/eventapi/MyCourses/byTerm/${timeSegmentId}`,
              {
                headers: {
                  "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
                  "X-RequestedLanguage": "EN",
                  "API-Version": "1",
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            return { id: semesterName, data: res.data || [] };
          } catch (err) {
            console.error(`Error loading courses for semester ${semesterName}:`, err);
            return { id: semesterName, data: [] };
          }
        }

        const data = await Promise.all(
          Object.entries(ratableSemesters).map(([semesterName, timeSegmentId]) =>
            loadRatingCourses(semesterName, timeSegmentId)
          )
        );

        const coursesRated = get(coursesRatedState) || [];

        const newData = data
          .map((semester) => {
            if (!semester) {
              return [];
            }
            const temp = (semester.data || [])
              .map((course) => {
                if (course === null || course === undefined) {
                  return null;
                }
                if (course.eventCourseNumber === null || course.eventCourseNumber === undefined) {
                  return {
                    courseId: "",
                    courseName: course.eventDescription,
                    semesterName: semester.id,
                  };
                }
                return {
                  courseId: course.eventCourseNumber,
                  courseName: course.eventDescription,
                  semesterName: semester.id,
                };
              })
              .filter((course) => course !== null);
            return temp;
          })
          .flat();

        const filteredCourses = newData.filter(
          (course) => !coursesRated.includes(course.courseId)
        );

        return filteredCourses;
      } catch (err) {
        console.error("Error fetching courses for rating:", err);
        return [];
      }
    },
  }),
});

export async function SubmitCourseRatingById(token, courseRating) {
  try {
    const res = await axios.post(
      `https://api.shsg.ch/course-ratings/`,
      courseRating,
      {
        headers: {
          "X-ApplicationId": "820e077d-4c13-45b8-b092-4599d78d45ec",
          "X-RequestedLanguage": "EN",
          "API-Version": "1",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Rating submitted successfully:", res.data);
    return res.data;
  } catch (err) {
    console.error("Error submitting course rating:", err);
    throw err;
  }
}



/**
 * Determines if a semester should be ratable based on current date and semester dates
 * @param {string} semesterShortName - The semester to check (e.g., "FS23")
 * @param {string} currentSemesterShortName - Current semester from cisIdList
 * @returns {boolean} - True if the semester should be ratable
 */
export const isSemesterRatable = (semesterShortName, currentSemesterShortName) => {

  if (!semesterShortName || !currentSemesterShortName){
    return false;
  }
  
  const targetSem = parseSemester(semesterShortName);
  const currentSem = parseSemester(currentSemesterShortName);
  
  if (!targetSem || !currentSem) {
    console.log("RATINGSV2: Failed to parse semester names.");
    return false;
  }
  // A semester is ratable if:
  // 1. It's from a previous year (but not more than 3 years ago), or
  // 2. It's from the current year but is a spring semester and we're in fall
  if (currentSem.year - targetSem.year > 3) return false;
  if (targetSem.year < currentSem.year) return true;
  if (targetSem.year === currentSem.year && targetSem.sem < currentSem.sem) return true;
  
  return false;
};

