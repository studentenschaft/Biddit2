// Loads a term's course catalog with the reference-semester fallback described
// in REFERENCE_SEMESTER.md. Concurrent loads of the same cisId share one request.
import { apiClient } from "./axiosClient";
import { catalogUrl } from "./apiEndpoints";
import { log } from "./log";

// A term shows its previous-year same-season catalog as a preview until it has
// published at least this many courses (or if its own catalog errors). Counts
// parent courses as returned by the API (before exercise-group flattening).
export const REFERENCE_FALLBACK_MIN_COURSES = 10;

const inFlight = new Map();

const fetchCatalog = (cisId, authToken) => {
  const pending = inFlight.get(cisId);
  if (pending) return pending;

  const request = apiClient
    .get(catalogUrl(cisId), authToken, {
      headers: { "X-RequestedLanguage": "EN" },
      suppressErrorToast: true,
    })
    .then((response) => response.data || [])
    .finally(() => inFlight.delete(cisId));
  inFlight.set(cisId, request);
  return request;
};

/**
 * @param {{ term: { cisId: string, shortName: string, referenceCisId?: string, referenceSemester?: string }, authToken: string }} params
 * @returns {Promise<{ courses: Array, usingReferenceData: boolean, referenceSemester: string|null, source: "primary"|"reference"|"none", error?: Error }>}
 */
export async function loadCatalogForTerm({ term, authToken }) {
  const hasReference =
    Boolean(term.referenceCisId) && term.referenceCisId !== term.cisId;

  // Resolves to the reference catalog, or null when there is none or it fails.
  const loadReference = async () => {
    if (!hasReference) return null;
    try {
      return await fetchCatalog(term.referenceCisId, authToken);
    } catch (error) {
      log.warn(
        `Could not load reference catalog ${term.referenceSemester} for ${term.shortName}:`,
        error?.message
      );
      return null;
    }
  };

  const fromReference = (courses) => {
    log.debug(
      `Previewing ${term.shortName} with ${courses.length} courses from reference ${term.referenceSemester}`
    );
    return {
      courses,
      usingReferenceData: true,
      referenceSemester: term.referenceSemester || null,
      source: "reference",
    };
  };

  try {
    const courses = await fetchCatalog(term.cisId, authToken);
    if ((courses?.length || 0) < REFERENCE_FALLBACK_MIN_COURSES) {
      const reference = await loadReference();
      if (reference !== null) return fromReference(reference);
    }
    return {
      courses,
      usingReferenceData: false,
      referenceSemester: null,
      source: "primary",
    };
  } catch (error) {
    const reference = await loadReference();
    if (reference !== null) return fromReference(reference);
    return {
      courses: [],
      usingReferenceData: false,
      referenceSemester: null,
      source: "none",
      error,
    };
  }
}

export const _resetCatalogLoaderForTests = () => inFlight.clear();
