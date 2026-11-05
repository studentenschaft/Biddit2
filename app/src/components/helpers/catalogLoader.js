// Loads a term's course catalog with the reference-semester fallback described
// in REFERENCE_SEMESTER.md. Each cisId is downloaded once per session:
// concurrent loads share the request and a failed load is retried next time.
import { apiClient } from "./axiosClient";
import { catalogUrl } from "./apiEndpoints";
import { log } from "./log";
import { cachedRequest } from "./sessionCache";

// A term shows its previous-year same-season catalog as a preview until it has
// published at least this many courses (or if its own catalog errors). Counts
// parent courses as returned by the API (before exercise-group flattening).
export const REFERENCE_FALLBACK_MIN_COURSES = 10;

const catalogs = new Map();

const fetchCatalog = (cisId, authToken) =>
  cachedRequest(catalogs, cisId, () =>
    apiClient
      .get(catalogUrl(cisId), authToken, {
        headers: { "X-RequestedLanguage": "EN" },
        suppressErrorToast: true,
      })
      .then((response) => response.data || [])
  );

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
    if (courses.length < REFERENCE_FALLBACK_MIN_COURSES) {
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

export const _resetCatalogLoaderForTests = () => catalogs.clear();
