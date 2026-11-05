import { apiClient } from "./axiosClient";
import { SHSG_API } from "./apiEndpoints";

const BASE_URL = `${SHSG_API}/curriculum-plans`;
// usePlanManager reports every failure, so apiClient must not toast as well.
const CALLER_REPORTS_ERRORS = { suppressErrorToast: true };

/**
 * Curriculum Plans API Client
 * All endpoints return full state: { activePlanId, plans: { [planId]: { name, placements } } }
 * The server auto-creates a default plan on first GET, so the response is always populated.
 */

/**
 * Fetch all curriculum plans for the authenticated user
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - { activePlanId, plans }
 */
export const getCurriculumPlans = async (token) => {
  const res = await apiClient.get(BASE_URL, token, CALLER_REPORTS_ERRORS);
  return res.data;
};

/**
 * Set active plan
 * @param {string} planId - Plan to activate
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const setActivePlanApi = async (planId, token) => {
  const res = await apiClient.post(
    `${BASE_URL}/active/${planId}`,
    {},
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Create or update a plan
 * @param {string} planId - Plan ID
 * @param {Object} data - { name?, placements?, semesterNotes?, wishlistOverrides? }
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const upsertPlan = async (planId, data, token) => {
  const res = await apiClient.post(
    `${BASE_URL}/${planId}`,
    data,
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Delete a plan
 * @param {string} planId - Plan ID to delete
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const deletePlanApi = async (planId, token) => {
  const res = await apiClient.delete(
    `${BASE_URL}/${planId}`,
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Duplicate a plan
 * @param {string} planId - Plan ID to duplicate
 * @param {string} name - Name for the new plan
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const duplicatePlanApi = async (planId, name, token) => {
  const res = await apiClient.post(
    `${BASE_URL}/${planId}/duplicate`,
    { name },
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Add or update a placement in a plan
 * @param {string} planId - Plan ID
 * @param {string} placementId - Placement ID
 * @param {Object} data - { type, semester, categoryPath, courseId?, shortName?, label?, credits?, note?, colorCode? }
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const upsertPlacement = async (planId, placementId, data, token) => {
  const res = await apiClient.post(
    `${BASE_URL}/${planId}/${placementId}`,
    data,
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Remove a placement from a plan
 * @param {string} planId - Plan ID
 * @param {string} placementId - Placement ID to remove
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const removePlacement = async (planId, placementId, token) => {
  const res = await apiClient.delete(
    `${BASE_URL}/${planId}/${placementId}`,
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};

/**
 * Set or clear a semester note in a plan
 * @param {string} planId - Plan ID
 * @param {string} semesterKey - Semester key (e.g., "FS26")
 * @param {string|null} note - Note text (null or empty to clear)
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const setSemesterNoteApi = async (planId, semesterKey, note, token) => {
  const res = await apiClient.post(
    `${BASE_URL}/${planId}/semester-notes/${semesterKey}`,
    { note },
    token,
    CALLER_REPORTS_ERRORS,
  );
  return res.data;
};
