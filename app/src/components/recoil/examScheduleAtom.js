import { atom } from "recoil";

/**
 * Central exam schedules keyed by semester shortName:
 * { "HS26": { plan } } — `plan: null` is a terminal, non-error state (the
 * artifact only exists for semesters that were ingested). Caching it here is
 * also what keeps the fetch to once per semester per session — Course Details
 * remounts on every tab visit.
 */
export const examSchedulesState = atom({
  key: "examSchedules",
  default: {},
});
