import { atomFamily } from "recoil";

// Bumped by the ingestion pipeline when the artifact shape changes. A tab left
// open across a deploy meets the new artifact with the old code, and a plan
// this code does not understand must not be rendered half-blind.
const SUPPORTED_SCHEMA_VERSION = 2;

/**
 * Fetches `public/exams/<semester>.json` with a plain `fetch`, not `apiClient`,
 * and checks its top-level shape only (ADR 0011).
 */
async function loadExamPlan(semester) {
  try {
    const response = await fetch(`/exams/${semester}.json`);
    // A semester that was never ingested. Netlify answers 404, but the Vite
    // dev server falls back to index.html with a 200.
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("application/json")) {
      return { status: "none", plan: null };
    }

    const plan = await response.json();
    if (
      plan?.schemaVersion === SUPPORTED_SCHEMA_VERSION &&
      Array.isArray(plan.written) &&
      Array.isArray(plan.oral)
    ) {
      return { status: "ready", plan };
    }
    console.warn(`Exam plan ${semester} has an unsupported schema or shape.`);
  } catch (error) {
    console.warn(`Exam plan ${semester} could not be loaded.`, error);
  }
  // The user just sees no exam dates; the warning is for whoever deployed.
  return { status: "error", plan: null };
}

/**
 * The exam plan of a semester as `{ status, plan }`, status one of "loading",
 * "ready", "none" (never ingested) or "error". Read it through
 * `examPlanSelector`, which refuses borrowed catalogs before this is touched.
 *
 * Loads itself on the first read in a store, so once per semester per store.
 */
export const examPlanState = atomFamily({
  key: "examPlan",
  default: { status: "loading", plan: null },
  effects: (semester) => [
    ({ node, trigger, setSelf, getInfo_UNSTABLE }) => {
      // Recoil re-runs effects with trigger "get" on the first render after
      // `initializeState`, so a seeded value is checked for as well.
      if (trigger === "get" && !getInfo_UNSTABLE(node).isSet) {
        loadExamPlan(semester).then(setSelf);
      }
    },
  ],
});
