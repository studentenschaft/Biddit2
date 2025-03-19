// import PropTypes from "prop-types";
import { useState } from "react";
import { useRecoilState } from "recoil";
import { useRecoilValue } from "recoil";
import { useSetRecoilState } from "recoil";

import { allCourseInfoState } from "../recoil/allCourseInfosSelector";
import { selectedSemesterIndexAtom } from "../recoil/selectedSemesterIndexAtom";

import { LockOpen } from "../leftCol/bottomRow/LockOpen";
import { LockClosed } from "../leftCol/bottomRow/LockClosed";
import { selectedTabAtom } from "../recoil/selectedTabAtom";
import { selectedCourseCourseInfo } from "../recoil/selectedCourseCourseInfo";

import { Heatmap } from "./Heatmap";

export default function SemesterSummary() {
  const setSelectedCourse = useSetRecoilState(selectedCourseCourseInfo);
  const setSelectedTab = useSetRecoilState(selectedTabAtom);
  const [courseOnDay, setCourseOnDay] = useState([]);
  const [hoveredDate, setHoveredDate] = useState(null);

  // const selectedCourses = useRecoilValue(selectedCoursesQuery);
  //localSelectedCourses? --> needs to be also sent to the backend
  // --> this is handled in the LockOpen component

  const [selectedSemester] = useRecoilState(selectedSemesterIndexAtom);
  const [hoveredCourse, setHoveredCourse] = useState(null);

  const allCourseInfo = useRecoilValue(allCourseInfoState);

  let adjustedSemester = selectedSemester;
  let currCourses = [];
  // if a future semester is selected, the index will be out of bounds
  // in this case, we need to set the index to a valid value that resembles same term /HS /FS in the present
  // and handle special cases like enrolled/selected courses differently TODO: THIS !!!
  // TODO: FIX logic blow to handle future semesters and show enrolled/selected courses
  if (allCourseInfo[adjustedSemester + 1]) {
    currCourses = allCourseInfo[adjustedSemester + 1].filter(
      (course) => course.enrolled || course.selected
    );
  } else {
    console.warn("Future semester (projection) selected");
    console.warn("index", adjustedSemester + 1);
    if (adjustedSemester + 1 === allCourseInfo.length) {
      adjustedSemester = 2;
    }
    if (adjustedSemester + 1 === allCourseInfo.length - 1) {
      adjustedSemester = 1;
    }
    if (allCourseInfo[adjustedSemester + 1]) {
      currCourses = allCourseInfo[adjustedSemester + 1].filter(
        (course) => course.enrolled || course.selected
      );
    }
  }
  console.log("coursesInfo", allCourseInfo[adjustedSemester + 1]);
  console.log("currCourses", currCourses);

  const totalCredits = currCourses.reduce((acc, curr) => {
    return acc + curr.credits / 100;
  }, 0);

  const totalEvents = currCourses.reduce((acc, curr) => {
    return acc + curr.calendarEntry.length;
  }, 0);

  function courseSelector(fullEvent) {
    if (fullEvent) {
      setSelectedCourse(fullEvent);
      setSelectedTab(0);
    }
  }

  function checkIfCourseOnDay(course) {
    for (let i = 0; i < courseOnDay.length; i++) {
      if (
        (course.courses &&
          course.courses.length > 0 &&
          courseOnDay[i] === course.courses[0].courseNumber) ||
        (!course.courses && courseOnDay[i] === course.courseNumber)
      ) {
        return true;
      }
    }
  }

  function returnEventOfThatDay(course) {
    if (!course.calendarEntry || course.calendarEntry.length === 0) {
      // fix if calendarEntry is empty
      return null;
    }

    for (let i = 0; i < course.calendarEntry.length; i++) {
      const entry = course.calendarEntry[i];
      if (!entry.eventDate) {
        continue; // Skip entries with empty eventDate
      }

      let event = new Date(entry.eventDate);
      if (
        event.getDate() === hoveredDate.getDate() &&
        event.getMonth() === hoveredDate.getMonth() &&
        event.getFullYear() === hoveredDate.getFullYear()
      ) {
        let starttimeString = "N/A";
        let endtimeString = "N/A";

        try {
          starttimeString =
            event.toLocaleTimeString("locale", {
              hour: "2-digit",
              minute: "2-digit",
            }) || "N/A";

          endtimeString =
            new Date(
              event.getTime() + (entry.durationInMinutes || 0) * 60000
            ).toLocaleTimeString("locale", {
              hour: "2-digit",
              minute: "2-digit",
            }) || "N/A";
        } catch (error) {
          console.error("Error formatting time:", error);
        }

        return {
          ...entry,
          starttimeString,
          endtimeString,
        };
      }
    }
    return null;
  }

  if (currCourses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm font-medium text-gray-500 align-middle md:text-base">
        You have no allocated or selected courses.
      </div>
    );
  } else {
    return (
      <div className="w-full px-4 py-5 sm:p-6">
        <Heatmap
          hovered={hoveredCourse}
          setCourseOnDay={setCourseOnDay}
          hoveredDate={hoveredDate}
          setHoveredDate={setHoveredDate}
        />
        <div className="w-full h-full">
          <div className="grid grid-cols-12 gap-4 px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded">
            <div className="text-center"></div>
            <div className="col-span-6 truncate">Course</div>

            <div className="col-span-3 truncate ">Classification</div>
            <div className="text-center">Events</div>
            <div className="text-center">ECTS </div>
          </div>
          <div className="inline-block w-full h-full min-w-full align-middle">
            <div className="ring-1 ring-black ring-opacity-5 md:rounded-lg ">
              {currCourses.map((course, index) => {
                return (
                  <div
                    key={index}
                    className={`grid grid-cols-12 gap-4 px-2 py-1 text-sm text-gray-900 rounded group hover:bg-gray-300 ${
                      checkIfCourseOnDay(course) ? "bg-gray-300" : ""
                    }`}
                    onMouseEnter={() => {
                      setHoveredCourse(course);
                    }}
                    onMouseLeave={() => {
                      setHoveredCourse(null);
                    }}
                  >
                    <div className="text-center">
                      <div
                        className={`flex justify-center items-center align-center h-full ${
                          course && course.overlapping
                            ? "border-warning text-warning cursor-pointer"
                            : course.enrolled
                            ? " border-main text-main cursor-not-allowed"
                            : course.selected
                            ? "border-main text-main cursor-pointer"
                            : ""
                        } ${
                          course && checkIfCourseOnDay(course)
                            ? "transform scale-110"
                            : ""
                        }`}
                      >
                        {course && course.enrolled ? (
                          <LockClosed clg="w-4 h-4 " />
                        ) : (
                          <LockOpen clg="w-4 h-4 " event={course} />
                        )}
                      </div>
                    </div>
                    <div
                      className={`col-span-6 font-semibold truncate cursor-pointer `}
                      onClick={() => courseSelector(course)}
                    >
                      {course.shortName}

                      {checkIfCourseOnDay(course) && (
                        <div className="pt-1 text-xs font-thin truncate transition">
                          {(() => {
                            const eventDetails = returnEventOfThatDay(course);
                            return eventDetails
                              ? `from ${eventDetails.starttimeString} to ${eventDetails.endtimeString}`
                              : "Time not available";
                          })()}
                        </div>
                      )}
                    </div>

                    <div className="col-span-3">
                      <div className="truncate ">{course.classification}</div>
                    </div>
                    <div className="text-center">
                      <div className="">{course.calendarEntry.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="">
                        {(course.credits / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-12 gap-4 px-2 py-1 pb-2 text-sm font-semibold text-gray-900 rounded">
            <div className="text-center truncate">Total</div>

            <div className="col-span-6 truncate ">
              {currCourses.length} Courses
            </div>
            <div className="col-span-3 text-center"></div>
            <div className="text-center">{totalEvents}</div>
            <div className="text-center relative">
              <span className={totalCredits > 30 ? "text-red-500" : ""}>
                {totalCredits.toFixed(2)}
              </span>
              {totalCredits > 30 && (
                <div className=" mb-2  text-gray-500 text-xs rounded py-1 px-2">
                  Warning: Exceeds recommended credit limit
                </div>
              )}
            </div>
            <div className="text-center"></div>
          </div>
        </div>
      </div>
    );
  }
}

export { SemesterSummary };
