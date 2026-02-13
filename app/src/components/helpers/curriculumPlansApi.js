import { apiClient } from "./axiosClient";
import { errorHandlingService } from "../errorHandling/ErrorHandlingService";

const BASE_URL = "http://localhost:5000/shsg-api/curriculum-plans";

/**
 * Curriculum Plans API Client
 * All endpoints return full state: { activePlanId, plans: { [planId]: { name, placements } } }
 */

/**
 * Fetch all curriculum plans for the authenticated user
 * @param {string} token - Authentication token
 * @returns {Promise<Object|null>} - { activePlanId, plans } or null if not found (new user)
 */
export const getCurriculumPlans = async (token) => {
  try {
    const res = await apiClient.get(BASE_URL, token);
    return res.data;
  } catch (err) {
    // 404 means new user with no saved plans - return null, don't treat as error
    if (err.response?.status === 404) {
      console.log("[CurriculumPlansAPI] No saved plans found (new user)");
      return null;
    }
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error fetching plans:", err);
    throw err;
  }
};

/**
 * Set active plan
 * @param {string} planId - Plan to activate
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const setActivePlanApi = async (planId, token) => {
  try {
    const res = await apiClient.post(`${BASE_URL}/active/${planId}`, {}, token);
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error setting active plan:", err);
    throw err;
  }
};

/**
 * Create or update a plan
 * @param {string} planId - Plan ID
 * @param {Object} data - { name?, placements? }
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const upsertPlan = async (planId, data, token) => {
  try {
    const res = await apiClient.post(`${BASE_URL}/${planId}`, data, token);
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error upserting plan:", err);
    throw err;
  }
};

/**
 * Delete a plan
 * @param {string} planId - Plan ID to delete
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const deletePlanApi = async (planId, token) => {
  try {
    const res = await apiClient.delete(`${BASE_URL}/${planId}`, token);
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error deleting plan:", err);
    throw err;
  }
};

/**
 * Duplicate a plan
 * @param {string} planId - Plan ID to duplicate
 * @param {string} name - Name for the new plan
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const duplicatePlanApi = async (planId, name, token) => {
  try {
    const res = await apiClient.post(
      `${BASE_URL}/${planId}/duplicate`,
      { name },
      token,
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error duplicating plan:", err);
    throw err;
  }
};

/**
 * Add or update a placement in a plan
 * @param {string} planId - Plan ID
 * @param {string} placementId - Placement ID
 * @param {Object} data - { type, semester, categoryPath, courseId?, shortName?, label?, credits?, note? }
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const upsertPlacement = async (planId, placementId, data, token) => {
  try {
    const res = await apiClient.post(
      `${BASE_URL}/${planId}/${placementId}`,
      data,
      token,
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error upserting placement:", err);
    throw err;
  }
};

/**
 * Remove a placement from a plan
 * @param {string} planId - Plan ID
 * @param {string} placementId - Placement ID to remove
 * @param {string} token - Authentication token
 * @returns {Promise<Object>} - Updated state
 */
export const removePlacement = async (planId, placementId, token) => {
  try {
    const res = await apiClient.delete(
      `${BASE_URL}/${planId}/${placementId}`,
      token,
    );
    return res.data;
  } catch (err) {
    errorHandlingService.handleError(err);
    console.error("[CurriculumPlansAPI] Error removing placement:", err);
    throw err;
  }
};
