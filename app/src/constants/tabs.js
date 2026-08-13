/**
 * Named identifiers for the right-column tabs.
 * The Recoil atom stores these ids; react-tabs works with indices,
 * so Biddit2.jsx converts at the boundary via tabIndexOf/tabIdAt.
 * Reordering TAB_GROUPS reorders the tab row without breaking navigation.
 */
export const TAB = {
  COURSE_DETAILS: "course-details",
  CALENDAR: "calendar",
  SUMMARY: "summary",
  TRANSCRIPT: "transcript",
  CURRICULUM_MAP: "curriculum-map",
  STUDY_OVERVIEW: "study-overview",
};

/** Default label per tab id. The Summary label is made semester-specific at render time. */
export const TAB_LABELS = {
  [TAB.COURSE_DETAILS]: "Course Details",
  [TAB.CALENDAR]: "Calendar",
  [TAB.SUMMARY]: "Semester Summary",
  [TAB.CURRICULUM_MAP]: "Curriculum Map",
  [TAB.STUDY_OVERVIEW]: "Study Overview",
  [TAB.TRANSCRIPT]: "Transcript",
};

/**
 * Visual grouping of the tab row by scope, read left→right as
 * This-Semester → My-Degree. This is the single source of tab order.
 */
export const TAB_GROUPS = [
  {
    label: "This Semester",
    tabs: [TAB.COURSE_DETAILS, TAB.CALENDAR, TAB.SUMMARY],
  },
  {
    label: "My Degree",
    tabs: [TAB.CURRICULUM_MAP, TAB.STUDY_OVERVIEW, TAB.TRANSCRIPT],
  },
];

/** Left→right tab order, derived from the groups so the two cannot drift. */
export const TAB_ORDER = TAB_GROUPS.flatMap((group) => group.tabs);

export function tabIndexOf(tabId) {
  const index = TAB_ORDER.indexOf(tabId);
  return index === -1 ? 0 : index;
}

export function tabIdAt(index) {
  return TAB_ORDER[index] ?? TAB_ORDER[0];
}
