// import PropTypes from "prop-types";
import { useEffect, useState, useMemo } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { useSetRecoilState } from "recoil";

import { allCourseInfoState } from "../recoil/allCourseInfosSelector";
import { selectedSemesterIndexAtom } from "../recoil/selectedSemesterAtom";
import { selectedSemesterAtom } from "../recoil/selectedSemesterAtom";
import { cisIdListSelector } from "../recoil/cisIdListSelector";
import { isFutureSemesterSelected, referenceSemester } from "../recoil/isFutureSemesterSelected";
import { localSelectedCoursesSemKeyState } from "../recoil/localSelectedCoursesSemKeyAtom";

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

  const [selectedSemesterIndex] = useRecoilState(selectedSemesterIndexAtom);
  const [selectedSemesterShortName] = useRecoilState(selectedSemesterAtom);
  const [hoveredCourse, setHoveredCourse] = useState(null);
  const cisIdList = useRecoilValue(cisIdListSelector);
  const isFutureSem = useRecoilValue(isFutureSemesterSelected);
  const refSemester = useRecoilValue(referenceSemester);

  const allCourseInfo = useRecoilValue(allCourseInfoState);
  // Add access to semester-keyed saved courses
  const localSelectedBySemester = useRecoilValue(localSelectedCoursesSemKeyState);
  
  // Find the appropriate semester data based on semester short name instead of index
  const currCourses = useMemo(() => {
    // Default case: Empty array when no data is available
    if (!allCourseInfo || Object.keys(allCourseInfo).length === 0) {
      return [];
    }

    // Get details about the selected semester
    const selectedSemesterDetails = cisIdList[selectedSemesterIndex];
    
    if (!selectedSemesterDetails) {
      return []; 
    }
    
    
    // For future semesters, use the semester-keyed saved courses directly
    if (isFutureSem && selectedSemesterShortName) {
      // Check if we have saved courses for this specific future semester
      const semesterSavedCourses = localSelectedBySemester[selectedSemesterShortName];
      console.log(`DEBUG SemesterSummary: Step 5A - Checking saved courses for future semester ${selectedSemesterShortName}:`, 
        semesterSavedCourses ? `Found ${semesterSavedCourses.length} courses` : "No courses found");
      
      if (semesterSavedCourses && semesterSavedCourses.length > 0) {
        console.log(`DEBUG SemesterSummary: Step 5B - Using ${semesterSavedCourses.length} saved courses for future semester ${selectedSemesterShortName}`);
        return semesterSavedCourses;
      }
    }
    
    // Normal case: Directly access data for current semester using the index
    if (allCourseInfo[selectedSemesterIndex + 1] && !isFutureSem) {
      console.log(`DEBUG SemesterSummary: Step 6 - Using current semester data at index ${selectedSemesterIndex + 1}`);
      return allCourseInfo[selectedSemesterIndex + 1].filter(
        (course) => course.enrolled || course.selected
      );
    }
    
    // Fallback for future semesters: Use reference semester as a backup method
    if (isFutureSem && refSemester) {
      // Try to get saved courses for the reference semester
      const refSemesterSavedCourses = localSelectedBySemester[refSemester.shortName];
      console.log(`DEBUG SemesterSummary: Step 7A - Checking reference semester ${refSemester.shortName} saved courses:`, 
        refSemesterSavedCourses ? `Found ${refSemesterSavedCourses.length} courses` : "No courses found");
      
      // If we have saved courses for reference semester, map them to future semester
      if (refSemesterSavedCourses && refSemesterSavedCourses.length > 0) {
        console.log(`DEBUG SemesterSummary: Step 7B - Using ${refSemesterSavedCourses.length} saved courses from reference semester ${refSemester.shortName}`);
        return refSemesterSavedCourses;
      }

      // Find the reference semester index in cisIdList as fallback
      const refIndex = cisIdList.findIndex(item => 
        item.shortName === refSemester.shortName
      );
      
      console.log(`DEBUG SemesterSummary: Step 7C - Reference semester index: ${refIndex}`);
      
      if (refIndex >= 0 && allCourseInfo[refIndex + 1]) {
        console.log(`DEBUG SemesterSummary: Step 7D - Using reference semester index ${refIndex} (${refSemester.shortName}) data`);
        return allCourseInfo[refIndex + 1].filter(course => course.selected);
      }
    }
    
    // Fallback: Try to find the most recent past semester with data
    
    // First try current semester (index 1), then previous semester (index 2)
    if (allCourseInfo[1]?.length > 0) {
      return allCourseInfo[1].filter(course => course.selected);
    } else if (allCourseInfo[2]?.length > 0) {
      return allCourseInfo[2].filter(course => course.selected);
    }
    
    // If all else fails, return empty array
    return [];
  }, [allCourseInfo, selectedSemesterIndex, selectedSemesterShortName, cisIdList, isFutureSem, refSemester, localSelectedBySemester]);

  const totalCredits = currCourses.reduce((acc, curr) => {
    return acc + curr.credits / 100;
  }, 0);

  const totalEvents = currCourses.reduce((acc, curr) => {
    return acc + (curr.calendarEntry?.length || 0);
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
    return false;
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
                      <div className="">{course.calendarEntry?.length || 0}</div>
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
