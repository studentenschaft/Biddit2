import { selector } from "recoil";
import moment from "moment/moment";

// Import unified course data
import {
  semesterCoursesSelector,
  allSemesterCoursesSelector,
  selectedSemesterSelector,
} from "./unifiedCourseDataSelectors";

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
    // Get the currently selected semester from unified state
    const selectedSemester = get(selectedSemesterSelector);
    const semShortName = selectedSemester;

    // Bail out if the semester shortName is invalid
    if (!semShortName) {
      console.warn(
        "CES: No selected semester available; returning empty array"
      );
      return [];
    }

    // Try to use unified course data first, fallback to legacy system
    let currentCourses = [];
    try {
      // Get courses from unified system for current semester
      // Get available courses that have been filtered (includes selected/enrolled flags)
      const filteredCourses = get(
        semesterCoursesSelector({
          semester: semShortName,
          type: "filtered",
        })
      );

      if (filteredCourses && filteredCourses.length > 0) {
        // Filter for enrolled or selected courses from unified system
        currentCourses = filteredCourses.filter(
          (course) => course.enrolled || course.selected
        );
        console.debug(
          "CalendarEntriesSelector - Using unified filtered courses:",
          currentCourses
        );
      } else {
        throw new Error("No unified courses available, falling back to legacy");
      }
    } catch (error) {
      console.debug(
        "CalendarEntriesSelector - Falling back to legacy data:",
        error.message
      );

      // Fallback to unified system with different approach
      const allCourses = get(allSemesterCoursesSelector);
      const futureSemesterSelected = get(isFutureSemesterSelected);
      const referenceSemester = get(referenceSemesterAtom);

      console.log(
        "CalendarEntriesSelector - selectedSemester:",
        selectedSemester,
        "referenceSemester:",
        referenceSemester
      );

      console.log(
        "CalendarEntriesSelector - allCourses:",
        allCourses,
        "futureSemesterSelected:",
        futureSemesterSelected
      );

      // Use the reference semester if future semester is selected
      let targetSemester = selectedSemester;
      if (futureSemesterSelected && referenceSemester) {
        targetSemester = referenceSemester.shortName || referenceSemester;
      }

      console.log(
        "CalendarEntriesSelector - Using targetSemester:",
        targetSemester
      );

      // Get courses from the unified system for the target semester
      if (allCourses && allCourses[targetSemester]) {
        const semesterData = allCourses[targetSemester];
        currentCourses = [
          ...(semesterData.enrolled || []),
          ...(semesterData.selected || []),
        ].filter((course) => course.enrolled || course.selected);
      } else {
        currentCourses = [];
      }

      console.debug(
        "CalendarEntriesSelector - currentCourses:",
        currentCourses
      );
    }

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

        // Note: no need to compute ISO strings here; comparisons use moment objects directly

        // Check for overlaps using the index - O(1) lookup for potential overlaps
        // Touching intervals (end == start) are NOT considered overlaps.
        let overlapping = false;
        for (const [otherStart, endSet] of timeSlotIndex.entries()) {
          const otherStartTime = moment(otherStart);

          // Iterate each potential end and apply strict interval overlap rules
          for (const endTime of endSet) {
            const otherEndTime = moment(endTime);

            // Skip comparing the event to itself
            if (
              otherStartTime.isSame(startMoment) &&
              otherEndTime.isSame(endMoment)
            ) {
              continue;
            }

            // Treat adjacency as non-overlap: A.end == B.start OR B.end == A.start
            if (
              otherStartTime.isSame(endMoment) ||
              otherEndTime.isSame(startMoment)
            ) {
              continue;
            }

            // Strict overlap check: [aStart, aEnd) intersects [bStart, bEnd)
            if (
              otherStartTime.isBefore(endMoment) &&
              otherEndTime.isAfter(startMoment)
            ) {
              overlapping = true;
              break;
            }
          }

          if (overlapping) break;
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
