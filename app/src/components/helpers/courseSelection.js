// helpers/courseSelection.js
import { normalizeSemesterKey } from "../../domain/semester";

/**
 * Reduces the many spellings of a semester to the canonical "HS25" form.
 * Study plans are keyed by this value, so it is what API calls must send.
 * A name that holds no semester key is returned unchanged.
 */
export const normalizeSemesterName = (name) =>
  normalizeSemesterKey(name) || name || "";
