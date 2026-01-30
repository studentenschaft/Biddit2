import { selector } from "recoil";
import moment from "moment/moment";

// Import unified course data
import {
  semesterCoursesSelector,
  selectedSemesterSelector,
} from "./unifiedCourseDataSelectors";

/**
 * Union-Find data structure for clustering overlapping events into collision groups.
 * Uses path compression for efficient lookups.
 */
class UnionFind {
  constructor() {
    this.parent = new Map();
  }

  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x))); // Path compression
    }
    return this.parent.get(x);
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) {
      this.parent.set(rootX, rootY);
    }
  }
}

/**
 * Single warning color for all collision groups.
 * Collision metadata (groupId, conflictsWith) is still computed for tooltips.
 */
export const COLLISION_COLOR = "#FCA311"; // Orange warning color

// Keep for backwards compatibility
export const COLLISION_COLORS = [COLLISION_COLOR];
export const getCollisionColor = () => COLLISION_COLOR;

/**
 * Check if two time intervals overlap (exclusive of touching boundaries).
 * Intervals [aStart, aEnd) and [bStart, bEnd) overlap if aStart < bEnd AND bStart < aEnd.
 */
const intervalsOverlap = (entryA, entryB) => {
  // Exact same slot counts as overlap
  if (entryA.start.isSame(entryB.start) && entryA.end.isSame(entryB.end)) {
    return true;
  }
  // Adjacent intervals (touching at boundary) are NOT overlaps
  if (entryA.end.isSame(entryB.start) || entryB.end.isSame(entryA.start)) {
    return false;
  }
  // Standard interval overlap check
  return entryA.start.isBefore(entryB.end) && entryB.start.isBefore(entryA.end);
};

/**
 * Build collision groups using Union-Find to cluster overlapping events.
 * Returns metadata about each entry including its collision group and conflicting courses.
 */
const buildCollisionGroups = (courses) => {
  const uf = new UnionFind();
  const entries = [];

  // Collect all calendar entries with unique IDs and precomputed time bounds
  courses.forEach((course, courseIdx) => {
    if (!course.calendarEntry) return;
    course.calendarEntry.forEach((entry, entryIdx) => {
      const entryId = `${courseIdx}-${entryIdx}`;
      const start = moment(entry.eventDate);
      const end = moment(start).add(entry.durationInMinutes, "minutes");
      entries.push({
        id: entryId,
        entry,
        course,
        courseIdx,
        entryIdx,
        start,
        end,
      });
    });
  });

  // Pairwise comparison to find overlaps and union them
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (intervalsOverlap(entries[i], entries[j])) {
        uf.union(entries[i].id, entries[j].id);
      }
    }
  }

  // Build group mapping: root → groupId (sequential numbers starting from 0)
  const rootToGroupId = new Map();
  let nextGroupId = 0;

  // Count members per group to identify actual collision groups (size > 1)
  const groupMembers = new Map();
  entries.forEach(({ id }) => {
    const root = uf.find(id);
    if (!groupMembers.has(root)) {
      groupMembers.set(root, []);
    }
    groupMembers.get(root).push(id);
  });

  // Only assign group IDs to groups with more than one member (actual collisions)
  groupMembers.forEach((members, root) => {
    if (members.length > 1) {
      rootToGroupId.set(root, nextGroupId++);
    }
  });

  // Build final entry metadata with collision info
  const entryMetadata = new Map();
  entries.forEach((entryData) => {
    const root = uf.find(entryData.id);
    const groupId = rootToGroupId.has(root) ? rootToGroupId.get(root) : null;

    // Find conflicting courses for this entry
    const conflictsWith = [];
    if (groupId !== null) {
      entries.forEach((other) => {
        if (other.id !== entryData.id && intervalsOverlap(entryData, other)) {
          const courseName = other.course?.shortName || other.course?.courseName;
          if (courseName && !conflictsWith.includes(courseName)) {
            conflictsWith.push(courseName);
          }
        }
      });
    }

    entryMetadata.set(entryData.id, {
      ...entryData,
      collisionGroupId: groupId,
      conflictsWith,
      overlapping: groupId !== null,
    });
  });

  return { entries, entryMetadata, groupCount: nextGroupId };
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
        "CES: No selected semester available; returning empty array",
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
        }),
      );

      if (filteredCourses && filteredCourses.length > 0) {
        // Filter for enrolled or selected courses from unified system
        currentCourses = filteredCourses.filter(
          (course) => course.enrolled || course.selected,
        );
        console.debug(
          "CalendarEntriesSelector - Using unified filtered courses:",
          currentCourses,
        );
      } else {
        throw new Error("No unified courses available, falling back to legacy");
      }
    } catch (error) {
      console.debug(
        "CalendarEntriesSelector - Falling back to legacy data:",
        error.message,
      );

      console.debug(
        "CalendarEntriesSelector - currentCourses:",
        currentCourses,
      );
    }

    // Use currentCourses as the relevant courses for the calendar
    const relevantCourses = currentCourses;

    // Build collision groups using Union-Find algorithm
    const { entryMetadata } = buildCollisionGroups(relevantCourses);

    // Build FullCalendar-style events from the relevant courses
    const calendarEntries = relevantCourses.flatMap((course, courseIdx) => {
      // If for future semesters we have no real schedule, calendarEntry might be empty or undefined
      if (!course.calendarEntry || course.calendarEntry.length === 0) {
        return [];
      }

      return course.calendarEntry.map((entry, entryIdx) => {
        // Convert event date & duration into FullCalendar's start/end
        const startMoment = moment(entry.eventDate);
        const endMoment = moment(startMoment).add(
          entry.durationInMinutes,
          "minutes",
        );

        // Get collision metadata for this entry
        const entryId = `${courseIdx}-${entryIdx}`;
        const metadata = entryMetadata.get(entryId) || {
          overlapping: false,
          collisionGroupId: null,
          conflictsWith: [],
        };

        // Determine color based on overlap or enrollment status
        let color;
        if (metadata.overlapping) {
          color = COLLISION_COLOR; // Orange for all overlapping courses
        } else if (course.enrolled) {
          color = "rgba(0,102,37, 1)"; // Green for enrolled courses
        } else {
          color = "rgb(156 163 175)"; // Gray for locally selected courses
        }

        // Return the final shape for FullCalendar
        return {
          // Copy over any original fields (like room, courseNumber, etc.)
          ...entry,
          title: course?.shortName,
          start: startMoment.toISOString(),
          end: endMoment.toISOString(),
          selected: true,
          overlapping: metadata.overlapping,
          collisionGroupId: metadata.collisionGroupId,
          conflictsWith: metadata.conflictsWith,
          color,
        };
      });
    });
    return calendarEntries;
  },
});
