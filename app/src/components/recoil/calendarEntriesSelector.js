import { selector } from "recoil";
import { selectedSemesterIndexAtom } from "./selectedSemesterAtom";
import moment from "moment/moment";
import { cisIdListSelector } from "./cisIdListSelector";

import { allCourseInfoState } from "./allCourseInfosSelector";

// for future semesters handling
import { isFutureSemesterSelected } from "./isFutureSemesterSelected";
import { referenceSemesterAtom } from "./referenceSemesterAtom";

/**
 * Build an index of overlapping time slots
 * Returns a Map where keys are event start times and values are sets of event end times
 */
const buildOverlapIndex = (courses) => {
  const timeSlotIndex = new Map();

  courses.forEach((course) => {
    if (!course.calendarEntry) return;

    course.calendarEntry.forEach((entry) => {
      const startMoment = moment(entry.eventDate);
      const endMoment = moment(startMoment).add(
        entry.durationInMinutes,
        "minutes"
      );

      // Store as ISO strings for consistent comparison
      const startIso = startMoment.toISOString();
      const endIso = endMoment.toISOString();

      // Add to the index
      if (!timeSlotIndex.has(startIso)) {
        timeSlotIndex.set(startIso, new Set());
      }
      timeSlotIndex.get(startIso).add(endIso);
    });
  });

  return timeSlotIndex;
};

export const calendarEntriesSelector = selector({
  key: "calendarEntriesSelector",
  get: ({ get }) => {
    const selectedSemesterIndex = get(selectedSemesterIndexAtom);
    const cisIdList = get(cisIdListSelector);
    const semShortName = cisIdList[selectedSemesterIndex]?.shortName || "";

    // Bail out if the semester index or shortName is invalid
    if (selectedSemesterIndex == null || !semShortName) {
      console.error(
        "CES: Invalid semester index or shortName; returning empty array",
        selectedSemesterIndex,
        semShortName
      );
      return [];
    }
    // Retrieve all courses and define the correct semester index.
    // If a future semester is selected, use the reference semester for course info.
    const allCourses = get(allCourseInfoState);
    const futureSemesterSelected = get(isFutureSemesterSelected);
    const referenceSemester = get(referenceSemesterAtom);

    console.log(
      "CalendarEntriesSelector - selectedSemesterIndex:",
      selectedSemesterIndex,
      "referenceSemester:",
      referenceSemester
    );

    console.log(
      "CalendarEntriesSelector - allCourses:",
      allCourses,
      "futureSemesterSelected:",
      futureSemesterSelected
    );

    let adjustedSemester = selectedSemesterIndex;
    if (futureSemesterSelected && referenceSemester != null) {
      // Check if referenceSemester is already a number, otherwise find the correct index
      if (typeof referenceSemester === "number") {
        adjustedSemester = referenceSemester;
      } else {
        // Find the index in cisIdList that corresponds to referenceSemester
        console.log("referenceSemester:", referenceSemester);
        console.log("cisIdList:", cisIdList);
        const referenceIndex = cisIdList.findIndex(
          (sem) => sem.shortName === referenceSemester.shortName
        );
        if (referenceIndex !== -1) {
          adjustedSemester = referenceIndex;
        }
      }
    }

    console.log(
      "CalendarEntriesSelector - Using adjustedSemester:",
      adjustedSemester,
      "which maps to:",
      allCourses[adjustedSemester + 1]
        ? `${allCourses[adjustedSemester + 1].length} courses`
        : "no courses"
    );

    const currentCourses = (allCourses[adjustedSemester + 1] || []).filter(
      (course) => course.enrolled || course.selected
    );

    console.debug("CalendarEntriesSelector - currentCourses:", currentCourses);

    // Use currentCourses as the relevant courses for the calendar
    const relevantCourses = currentCourses;

    // Build an index for quick overlap detection
    const timeSlotIndex = buildOverlapIndex(relevantCourses);

    // Now build FullCalendar-style events from the relevant courses
    const calendarEntries = relevantCourses.flatMap((course) => {
      // If for future semesters we have no real schedule, calendarEntry might be empty or undefined
      if (!course.calendarEntry || course.calendarEntry.length === 0) {
        // Optionally, return an empty array here or create a "TBD" event
        return [];
      }

      return course.calendarEntry.map((entry) => {
        // Convert event date & duration into FullCalendar's start/end
        const startMoment = moment(entry.eventDate);
        const endMoment = moment(startMoment).add(
          entry.durationInMinutes,
          "minutes"
        );

        const startIso = startMoment.toISOString();
        const endIso = endMoment.toISOString();

        // Check for overlaps using the index - O(1) lookup for potential overlaps
        // This assumes that events with the same start time will overlap if they have different end times
        let overlapping = false;
        for (const [otherStart, endSet] of timeSlotIndex.entries()) {
          const otherStartTime = moment(otherStart);

          // Skip entries for this exact course/event
          if (
            otherStart === startIso &&
            endSet.size === 1 &&
            endSet.has(endIso)
          ) {
            continue;
          }

          // Check for any overlap
          if (
            otherStartTime.isBefore(endMoment) &&
            Array.from(endSet).some((endTime) => {
              const otherEndTime = moment(endTime);
              return otherEndTime.isAfter(startMoment);
            })
          ) {
            overlapping = true;
            break;
          }
        }

        // Return the final shape for FullCalendar
        return {
          // Copy over any original fields (like room, courseNumber, etc.)
          ...entry,
          title: course?.shortName,
          start: startMoment.toISOString(),
          end: endMoment.toISOString(),
          selected: true,
          overlapping,
          color: overlapping
            ? "rgba(252, 163, 17, 1)" // Orange when overlapping
            : course.enrolled
            ? "rgba(0,102,37, 1)" // Green if truly "enrolled" (current sem)
            : "rgb(156 163 175)", // Gray if only locally selected
        };
      });
    });

    return calendarEntries;
  },
});
