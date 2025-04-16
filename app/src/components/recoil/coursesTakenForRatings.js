import { atom, selector } from "recoil";
import { authTokenState } from "./authAtom";
import axios from "axios";
//import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

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
          //errorHandlingService.handleError(err);
          return console.log(err);
        }
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

      // here we define the rate-able semesters and their timeSegmentId
      // i.e., allow ratings for users
      // tip: use https://integration.unisg.ch/EventApi/CisTermAndPhaseInformations to get correct timeSegmentId
      const ratingSemesterTimeSegmentIds = {
        "Fall 24": "b6758836-d1d0-4731-a030-852322ebc880",
        "Spring 24": "cdb7331b-2557-46b9-b5dd-4151d8bf0962",
        "Fall 23": "da0fc4f3-7942-4cac-85cd-d8a5f733fe97",
        "Spring 23": "180fed8a-9db7-4e6e-aebb-22f6959b0f42",
        "Fall 22": "67780ec0-88e3-4095-a998-2dbf77921493",
        "Spring 22": "b987f42f-0c9b-41b2-b8af-97844b0e939d",
        "Fall 21": "ba8c222e-1d66-4a6f-88c6-d9739715d671",
      };

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

            return { id: semesterName, data: res.data };
          } catch (err) {
            //errorHandlingService.handleError(err);
            return console.log(err);
          }
        }
      }

      const data = await Promise.all(
        Object.keys(ratingSemesterTimeSegmentIds).map((timeSegmentId) =>
          loadRatingCourses(
            timeSegmentId,
            ratingSemesterTimeSegmentIds[timeSegmentId]
          )
        )
      ).then((results) => {
        return results;
      });

      const coursesRated = get(coursesRatedState) || []; // fix for Error Message: undefined is not an object (evaluating 'o.includes')(27.02.25) (line 152)

      const newData = data
        .map((semester) => {
          if (!semester) {
            console.log(`DEBUG: Skipping undefined semester:`); // (Bug Fix 03.02.25)
            return [];
          }
          const temp = (semester.data || [])
            .map((course) => {
              if (course === null || course === undefined) {
                console.log(
                  `DEBUG: Skipping null or undefined course in semester ${semester.id}`
                ); // Log the skipped course (Bug Fix 21.06.24)
                return null;
              }
              // potential fix for eventCourseNumber crash
              if (
                course.eventCourseNumber === null ||
                course.eventCourseNumber === undefined
              ) {
                console.log(
                  `DEBUG: Skipping course with null or undefined eventCourseNumber in semester ${semester.id}`
                ); // Log the skipped course (Bug Fix 21.06.24)
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
            .filter((course) => course !== null); // Remove any null entries from courses (Bug Fix 21.06.24)
          return temp;
        })
        .flat();

      const filteredCourses = newData.filter(
        (course) => !coursesRated.includes(course.courseId)
      );

      // console.log("filteredCourses", filteredCourses);

      return filteredCourses;
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
    console.log(res.data);
  } catch (err) {
    //errorHandlingService.handleError(err);
    console.log("error" + err);
  }
}
