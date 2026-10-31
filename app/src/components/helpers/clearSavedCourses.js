import { deleteCourse, getStudyPlan } from "./api";

/**
 * The course IDs of a study plan, or none if the backend sent a shape we do not
 * recognise.
 *
 * A non-array is never iterated: a string would be walked character by
 * character, firing a delete per letter. It is a data surprise, not an empty
 * plan, so it is reported rather than swallowed.
 */
const coursesOf = (plan) => {
  if (Array.isArray(plan.courses)) return plan.courses;

  if (plan.courses != null && import.meta.env.DEV) {
    console.warn(
      `[clearSavedCourses] Study plan "${plan.id}" has a non-array courses value; treating it as empty.`,
      plan.courses
    );
  }

  return [];
};

/**
 * Deletes every saved course across every semester the backend knows about.
 *
 * Reads the server rather than app state: this is the escape hatch for entries
 * the normal UI cannot reach, so it must see unfiltered plans.
 *
 * @throws if the study plans cannot be loaded - an empty wipe and a failed one
 *   must not look the same to the caller.
 * @returns {Promise<{total: number, deleted: number}>}
 */
export const clearSavedCourses = async (authToken) => {
  const plans = (await getStudyPlan(authToken))
    .filter((plan) => plan?.id)
    .map((plan) => ({ id: plan.id, courses: coursesOf(plan) }))
    .filter((plan) => plan.courses.length > 0);

  const total = plans.reduce((sum, plan) => sum + plan.courses.length, 0);
  let deleted = 0;

  for (const plan of plans) {
    for (const courseId of plan.courses) {
      // Errors are counted, not reported: one 404 must not abandon the wipe,
      // and an outage must not stack a persistent toast per course.
      if (
        await deleteCourse(plan.id, courseId, authToken, { reportErrors: false })
      ) {
        deleted += 1;
      }
    }
  }

  return { total, deleted };
};

/** What to tell the user, and whether the page should reload afterwards. */
export const clearOutcome = ({ total, deleted }) => {
  if (total === 0) {
    return { message: "No saved courses found to clear.", reload: false };
  }
  if (deleted === 0) {
    return {
      message: `Could not clear your ${total} saved courses. Please try again, and contact us if it keeps failing.`,
      reload: false,
    };
  }
  if (deleted < total) {
    return {
      message: `Cleared ${deleted} of ${total} saved courses. Some could not be removed - refreshing the page now.`,
      reload: true,
    };
  }
  return {
    message:
      "All saved courses have been cleared from all semesters - refreshing the page now.",
    reload: true,
  };
};

/** Shown when the wishlist could not be read at all - never "you have none". */
export const CLEAR_LOAD_FAILURE_MESSAGE =
  "Could not load your saved courses. Please try again.";
