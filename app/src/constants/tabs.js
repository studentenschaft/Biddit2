/**
 * Named identifiers for the right-column tabs.
 * The Recoil atom stores these ids; react-tabs works with indices,
 * so Biddit2.jsx converts at the boundary via tabIndexOf/tabIdAt.
 * Reordering TAB_ORDER reorders the tab row without breaking navigation.
 */
export const TAB = {
  COURSE_DETAILS: "course-details",
  CALENDAR: "calendar",
  SUMMARY: "summary",
  TRANSCRIPT: "transcript",
  CURRICULUM_MAP: "curriculum-map",
};

export const TAB_ORDER = [
  TAB.COURSE_DETAILS,
  TAB.CALENDAR,
  TAB.SUMMARY,
  TAB.TRANSCRIPT,
  TAB.CURRICULUM_MAP,
];

export function tabIndexOf(tabId) {
  const index = TAB_ORDER.indexOf(tabId);
  return index === -1 ? 0 : index;
}

export function tabIdAt(index) {
  return TAB_ORDER[index] ?? TAB_ORDER[0];
}
