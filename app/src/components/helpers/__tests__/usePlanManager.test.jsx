/**
 * usePlanManager.test.jsx
 *
 * Tests every operation the hook exposes, with the curriculum-plans HTTP
 * client mocked at the module boundary. Each test seeds the relevant Recoil
 * atoms via RecoilRoot's initializeState, invokes a hook method, and asserts:
 *   - the right API function was called,
 *   - with the right arguments (plan id, placement id, payload shape),
 *   - resulting Recoil state matches the API response.
 *
 * This is the first executable safety net for the API orchestrator: the main
 * way the UI persists curriculum-plan data to the SHSG backend.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { RecoilRoot, useRecoilValue } from "recoil";

import { authTokenState } from "../../recoil/authAtom";
import {
  curriculumPlanState,
  getDefaultPlanState,
} from "../../recoil/curriculumPlanAtom";
import { curriculumPlansRegistryState } from "../../recoil/curriculumPlansRegistryAtom";
import { unifiedCourseDataState } from "../../recoil/unifiedCourseDataAtom";

// --- Mocks ---
// vi.mock() factories are hoisted above module-level consts, so we capture
// mock references via vi.hoisted() to keep them in scope.

const { mockToast, api } = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    update: vi.fn(),
  });
  const apiMocks = {
    getCurriculumPlans: vi.fn(),
    setActivePlanApi: vi.fn(),
    upsertPlan: vi.fn(),
    deletePlanApi: vi.fn(),
    duplicatePlanApi: vi.fn(),
    upsertPlacement: vi.fn(),
    removePlacement: vi.fn(),
    setSemesterNoteApi: vi.fn(),
  };
  return { mockToast: toast, api: apiMocks };
});

vi.mock("react-toastify", () => ({ toast: mockToast }));

vi.mock("../curriculumPlansApi", () => ({
  getCurriculumPlans: (...args) => api.getCurriculumPlans(...args),
  setActivePlanApi: (...args) => api.setActivePlanApi(...args),
  upsertPlan: (...args) => api.upsertPlan(...args),
  deletePlanApi: (...args) => api.deletePlanApi(...args),
  duplicatePlanApi: (...args) => api.duplicatePlanApi(...args),
  upsertPlacement: (...args) => api.upsertPlacement(...args),
  removePlacement: (...args) => api.removePlacement(...args),
  setSemesterNoteApi: (...args) => api.setSemesterNoteApi(...args),
}));

import usePlanManager from "../usePlanManager";

// --- Helpers ---

const TOKEN = "test-token";

const planResponse = (overrides = {}) => ({
  activePlanId: "plan-default",
  plans: {
    "plan-default": {
      name: "My Plan",
      createdAt: "2026-01-01T00:00:00.000Z",
      lastModified: "2026-01-01T00:00:00.000Z",
      placements: [],
      semesterNotes: {},
      ...overrides,
    },
  },
});

const buildWrapper = (seed) => {
  const wrapper = ({ children }) => (
    <RecoilRoot
      initializeState={({ set }) => {
        set(authTokenState, TOKEN);
        if (seed) seed(set);
      }}
    >
      {children}
    </RecoilRoot>
  );
  return wrapper;
};

/**
 * Hook that exposes both the manager and the atoms we assert against, so a
 * single renderHook gives us a stable handle to both actions and state.
 */
const useHarness = () => ({
  manager: usePlanManager(),
  registry: useRecoilValue(curriculumPlansRegistryState),
  plan: useRecoilValue(curriculumPlanState),
});

const renderManager = (seed) =>
  renderHook(() => useHarness(), { wrapper: buildWrapper(seed) });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  mockToast.error.mockReset();
  mockToast.info.mockReset();
  mockToast.loading.mockReset().mockReturnValue("toast-id");
  mockToast.update.mockReset();
});

// --- loadPlans ---

describe("loadPlans", () => {
  it("populates registry and active plan from API response", async () => {
    api.getCurriculumPlans.mockResolvedValueOnce({
      activePlanId: "plan-default",
      plans: {
        "plan-default": {
          name: "Server Plan",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastModified: "2026-02-02T00:00:00.000Z",
          placements: [
            {
              placementId: "course-ABC",
              type: "course",
              semester: "FS26",
              categoryPath: "Core",
              courseId: "ABC",
              shortName: "Intro",
            },
          ],
          semesterNotes: { FS26: "retake" },
        },
      },
    });

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.loadPlans();
    });

    expect(api.getCurriculumPlans).toHaveBeenCalledWith(TOKEN);
    expect(result.current.registry.isLoaded).toBe(true);
    expect(result.current.registry.activePlanId).toBe("plan-default");
    expect(result.current.registry.plans["plan-default"].name).toBe(
      "Server Plan",
    );
    expect(result.current.plan.plannedItems.FS26).toHaveLength(1);
    expect(result.current.plan.plannedItems.FS26[0].courseId).toBe("ABC");
    expect(result.current.plan.semesterNotes.FS26).toBe("retake");
  });

  it("is a no-op when registry is already loaded", async () => {
    const { result } = renderManager((set) => {
      set(curriculumPlansRegistryState, (prev) => ({
        ...prev,
        isLoaded: true,
      }));
    });

    await act(async () => {
      await result.current.manager.loadPlans();
    });

    expect(api.getCurriculumPlans).not.toHaveBeenCalled();
  });

  it("marks registry loaded and toasts on error (prevents infinite retry)", async () => {
    api.getCurriculumPlans.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.loadPlans();
    });

    expect(result.current.registry.isLoaded).toBe(true);
    expect(mockToast.error).toHaveBeenCalled();
  });
});

// --- switchPlan ---

describe("switchPlan", () => {
  const seedTwoPlans = (set) => {
    set(curriculumPlansRegistryState, {
      activePlanId: "plan-default",
      plans: {
        "plan-default": { id: "plan-default", name: "A" },
        "plan-two": { id: "plan-two", name: "B" },
      },
      schemaVersion: 1,
      isLoaded: true,
      isDirty: false,
    });
  };

  it("saves the current plan, calls setActivePlanApi, loads the target", async () => {
    api.upsertPlan.mockResolvedValueOnce(planResponse());
    api.setActivePlanApi.mockResolvedValueOnce({
      activePlanId: "plan-two",
      plans: {
        "plan-default": {
          name: "A",
          placements: [],
          semesterNotes: {},
        },
        "plan-two": {
          name: "B",
          placements: [
            {
              placementId: "course-XYZ",
              type: "course",
              semester: "HS26",
              categoryPath: "Elective",
              courseId: "XYZ",
            },
          ],
          semesterNotes: {},
        },
      },
    });

    const { result } = renderManager(seedTwoPlans);

    await act(async () => {
      await result.current.manager.switchPlan("plan-two");
    });

    expect(api.upsertPlan).toHaveBeenCalledWith(
      "plan-default",
      expect.objectContaining({ placements: [], semesterNotes: {} }),
      TOKEN,
    );
    expect(api.setActivePlanApi).toHaveBeenCalledWith("plan-two", TOKEN);
    expect(result.current.registry.activePlanId).toBe("plan-two");
    expect(result.current.plan.plannedItems.HS26).toHaveLength(1);
  });

  it("is a no-op when switching to the already-active plan", async () => {
    const { result } = renderManager(seedTwoPlans);

    await act(async () => {
      await result.current.manager.switchPlan("plan-default");
    });

    expect(api.upsertPlan).not.toHaveBeenCalled();
    expect(api.setActivePlanApi).not.toHaveBeenCalled();
  });

  it("is a no-op for an unknown plan id", async () => {
    const { result } = renderManager(seedTwoPlans);

    await act(async () => {
      await result.current.manager.switchPlan("plan-unknown");
    });

    expect(api.upsertPlan).not.toHaveBeenCalled();
    expect(api.setActivePlanApi).not.toHaveBeenCalled();
  });
});

// --- createPlan ---

describe("createPlan", () => {
  it("saves current, creates a new plan, sets it active, returns new id", async () => {
    api.upsertPlan
      .mockResolvedValueOnce(planResponse()) // save current
      .mockResolvedValueOnce(planResponse()); // create new
    api.setActivePlanApi.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    let newId;
    await act(async () => {
      newId = await result.current.manager.createPlan("Fresh");
    });

    expect(newId).toMatch(/^plan-\d+/);
    expect(api.upsertPlan).toHaveBeenCalledTimes(2);
    const [, createCall] = api.upsertPlan.mock.calls;
    expect(createCall[1]).toEqual({ name: "Fresh", placements: [] });
    expect(api.setActivePlanApi).toHaveBeenCalledWith(newId, TOKEN);
    expect(result.current.registry.activePlanId).toBe(newId);
    expect(result.current.registry.plans[newId].name).toBe("Fresh");
  });

  it("toasts on error", async () => {
    api.upsertPlan.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.createPlan("Fresh");
    });

    expect(mockToast.error).toHaveBeenCalled();
  });
});

// --- duplicatePlan ---

describe("duplicatePlan", () => {
  const seed = (set) => {
    set(curriculumPlansRegistryState, {
      activePlanId: "plan-default",
      plans: { "plan-default": { id: "plan-default", name: "A" } },
      schemaVersion: 1,
      isLoaded: true,
      isDirty: false,
    });
  };

  it("saves current, calls duplicatePlanApi, adds the returned plan", async () => {
    api.upsertPlan.mockResolvedValueOnce(planResponse());
    api.duplicatePlanApi.mockResolvedValueOnce({
      activePlanId: "plan-default",
      plans: {
        "plan-default": { name: "A", placements: [], semesterNotes: {} },
        "plan-copy-1": {
          name: "A (copy)",
          createdAt: "2026-04-01T00:00:00.000Z",
          lastModified: "2026-04-01T00:00:00.000Z",
          placements: [],
          semesterNotes: {},
        },
      },
    });

    const { result } = renderManager(seed);

    let newId;
    await act(async () => {
      newId = await result.current.manager.duplicatePlan(
        "plan-default",
        "A (copy)",
      );
    });

    expect(api.duplicatePlanApi).toHaveBeenCalledWith(
      "plan-default",
      "A (copy)",
      TOKEN,
    );
    expect(newId).toBe("plan-copy-1");
    expect(result.current.registry.activePlanId).toBe("plan-copy-1");
  });

  it("is a no-op for unknown source plan id", async () => {
    const { result } = renderManager(seed);

    await act(async () => {
      await result.current.manager.duplicatePlan("plan-unknown");
    });

    expect(api.duplicatePlanApi).not.toHaveBeenCalled();
  });
});

// --- deletePlan ---

describe("deletePlan", () => {
  it("refuses to delete when only one plan exists", async () => {
    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.deletePlan("plan-default");
    });

    expect(api.deletePlanApi).not.toHaveBeenCalled();
  });

  it("deletes and switches active plan when the active one is deleted", async () => {
    api.deletePlanApi.mockResolvedValueOnce({
      activePlanId: "plan-two",
      plans: {
        "plan-two": {
          name: "B",
          placements: [],
          semesterNotes: {},
        },
      },
    });

    const { result } = renderManager((set) => {
      set(curriculumPlansRegistryState, {
        activePlanId: "plan-default",
        plans: {
          "plan-default": { id: "plan-default", name: "A" },
          "plan-two": { id: "plan-two", name: "B" },
        },
        schemaVersion: 1,
        isLoaded: true,
        isDirty: false,
      });
    });

    await act(async () => {
      await result.current.manager.deletePlan("plan-default");
    });

    expect(api.deletePlanApi).toHaveBeenCalledWith("plan-default", TOKEN);
    expect(result.current.registry.activePlanId).toBe("plan-two");
    expect(result.current.registry.plans["plan-default"]).toBeUndefined();
  });
});

// --- renamePlan ---

describe("renamePlan", () => {
  it("calls upsertPlan with name only", async () => {
    api.upsertPlan.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.renamePlan("plan-default", "Renamed");
    });

    expect(api.upsertPlan).toHaveBeenCalledWith(
      "plan-default",
      { name: "Renamed" },
      TOKEN,
    );
    expect(result.current.registry.plans["plan-default"].name).toBe("Renamed");
  });

  it("is a no-op for unknown plan id", async () => {
    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.renamePlan("plan-unknown", "X");
    });

    expect(api.upsertPlan).not.toHaveBeenCalled();
  });
});

// --- addCourseById / removeCourseById ---

describe("course placements", () => {
  it("addCourseById sends the right placement payload", async () => {
    api.upsertPlacement.mockResolvedValueOnce({
      activePlanId: "plan-default",
      plans: {
        "plan-default": {
          name: "My Plan",
          placements: [
            {
              placementId: "course-ABC",
              type: "course",
              semester: "FS26",
              categoryPath: "Core",
              courseId: "ABC",
              shortName: "Intro",
            },
          ],
          semesterNotes: {},
        },
      },
    });

    const { result } = renderManager();

    let ok;
    await act(async () => {
      ok = await result.current.manager.addCourseById(
        "ABC",
        "FS26",
        "Core",
        "Intro",
      );
    });

    expect(ok).toBe(true);
    const [planId, placementId, payload, token] =
      api.upsertPlacement.mock.calls[0];
    expect(planId).toBe("plan-default");
    expect(placementId).toBe("course-ABC");
    expect(payload).toMatchObject({
      type: "course",
      semester: "FS26",
      categoryPath: "Core",
      courseId: "ABC",
      shortName: "Intro",
    });
    expect(token).toBe(TOKEN);
    expect(result.current.plan.plannedItems.FS26).toHaveLength(1);
  });

  it("addCourseById returns false on API failure", async () => {
    api.upsertPlacement.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderManager();

    let ok;
    await act(async () => {
      ok = await result.current.manager.addCourseById("ABC", "FS26", "Core");
    });

    expect(ok).toBe(false);
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("removeCourseById calls removePlacement with course-{id}", async () => {
    api.removePlacement.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    let ok;
    await act(async () => {
      ok = await result.current.manager.removeCourseById("ABC");
    });

    expect(ok).toBe(true);
    expect(api.removePlacement).toHaveBeenCalledWith(
      "plan-default",
      "course-ABC",
      TOKEN,
    );
  });
});

// --- placeholders ---

describe("placeholders", () => {
  it("addPlaceholderById generates an id when none is provided", async () => {
    api.upsertPlacement.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    let id;
    await act(async () => {
      id = await result.current.manager.addPlaceholderById(
        "FS26",
        "Core",
        6,
        "Elective",
      );
    });

    expect(id).toMatch(/^placeholder-/);
    const [, placementId, payload] = api.upsertPlacement.mock.calls[0];
    expect(placementId).toBe(id);
    expect(payload).toMatchObject({
      type: "placeholder",
      semester: "FS26",
      categoryPath: "Core",
      credits: 6,
      label: "Elective",
    });
  });

  it("addPlaceholderById uses provided id", async () => {
    api.upsertPlacement.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    let id;
    await act(async () => {
      id = await result.current.manager.addPlaceholderById(
        "FS26",
        "Core",
        6,
        "Elective",
        "placeholder-custom",
      );
    });

    expect(id).toBe("placeholder-custom");
  });

  it("addPlaceholderById returns null on API failure", async () => {
    api.upsertPlacement.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderManager();

    let id;
    await act(async () => {
      id = await result.current.manager.addPlaceholderById("FS26", "Core", 6);
    });

    expect(id).toBe(null);
  });

  it("removePlaceholderById calls removePlacement directly", async () => {
    api.removePlacement.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    let ok;
    await act(async () => {
      ok = await result.current.manager.removePlaceholderById("placeholder-1");
    });

    expect(ok).toBe(true);
    expect(api.removePlacement).toHaveBeenCalledWith(
      "plan-default",
      "placeholder-1",
      TOKEN,
    );
  });
});

// --- updatePlacementById ---

describe("updatePlacementById", () => {
  it("forwards extra data and the target semester/category", async () => {
    api.upsertPlacement.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.updatePlacementById(
        "course-ABC",
        "HS26",
        "Elective",
        { type: "course", courseId: "ABC", shortName: "Intro" },
      );
    });

    const [planId, placementId, payload] = api.upsertPlacement.mock.calls[0];
    expect(planId).toBe("plan-default");
    expect(placementId).toBe("course-ABC");
    expect(payload).toEqual({
      type: "course",
      courseId: "ABC",
      shortName: "Intro",
      semester: "HS26",
      categoryPath: "Elective",
    });
  });
});

// --- semester notes ---

describe("setSemesterNoteById", () => {
  it("trims, caps to 200 chars, and posts to the API", async () => {
    api.setSemesterNoteApi.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();
    const long = "  " + "x".repeat(300) + "  ";

    await act(async () => {
      await result.current.manager.setSemesterNoteById("FS26", long);
    });

    const [planId, semesterKey, note, token] =
      api.setSemesterNoteApi.mock.calls[0];
    expect(planId).toBe("plan-default");
    expect(semesterKey).toBe("FS26");
    expect(note).toHaveLength(200);
    expect(token).toBe(TOKEN);
  });

  it("sends null when the note is empty (to clear)", async () => {
    api.setSemesterNoteApi.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    await act(async () => {
      await result.current.manager.setSemesterNoteById("FS26", "   ");
    });

    expect(api.setSemesterNoteApi).toHaveBeenCalledWith(
      "plan-default",
      "FS26",
      null,
      TOKEN,
    );
  });

  it("is a no-op and returns false when there is no active plan", async () => {
    const { result } = renderManager((set) => {
      set(curriculumPlansRegistryState, {
        activePlanId: null,
        plans: {},
        schemaVersion: 1,
        isLoaded: true,
        isDirty: false,
      });
    });

    let ok;
    await act(async () => {
      ok = await result.current.manager.setSemesterNoteById("FS26", "x");
    });

    expect(ok).toBe(false);
    expect(api.setSemesterNoteApi).not.toHaveBeenCalled();
  });
});

// --- syncActivePlan ---

describe("syncActivePlan", () => {
  it("converts plannedItems to placements and calls upsertPlan", async () => {
    api.upsertPlan.mockResolvedValueOnce(planResponse());

    const { result } = renderManager();

    const plannedItems = {
      FS26: [
        {
          type: "course",
          courseId: "ABC",
          shortName: "Intro",
          categoryPath: "Core",
        },
      ],
    };

    let ok;
    await act(async () => {
      ok = await result.current.manager.syncActivePlan(plannedItems, {
        FS26: "note",
      });
    });

    expect(ok).toBe(true);
    const [planId, payload] = api.upsertPlan.mock.calls[0];
    expect(planId).toBe("plan-default");
    expect(payload.semesterNotes).toEqual({ FS26: "note" });
    expect(payload.placements).toEqual([
      {
        placementId: "course-ABC",
        type: "course",
        semester: "FS26",
        categoryPath: "Core",
        courseId: "ABC",
        shortName: "Intro",
      },
    ]);
  });

  it("returns false when there is no active plan", async () => {
    const { result } = renderManager((set) => {
      set(curriculumPlansRegistryState, {
        activePlanId: null,
        plans: {},
        schemaVersion: 1,
        isLoaded: true,
        isDirty: false,
      });
    });

    let ok;
    await act(async () => {
      ok = await result.current.manager.syncActivePlan({});
    });

    expect(ok).toBe(false);
    expect(api.upsertPlan).not.toHaveBeenCalled();
  });
});

// --- importSelectedCourses ---

describe("importSelectedCourses", () => {
  const coursesInFutureSemester = (set) => {
    set(curriculumPlanState, getDefaultPlanState());
    set(unifiedCourseDataState, {
      semesters: {
        HS49: {
          selectedIds: ["ABC", "XYZ"],
          available: [
            {
              courseNumber: "ABC",
              shortName: "Intro",
              classification: "Core",
            },
            {
              courseNumber: "XYZ",
              shortName: "Advanced",
              classification: "Elective",
            },
          ],
        },
      },
      selectedSemester: null,
      latestValidTerm: null,
    });
  };

  it("merges existing placements with new imports and calls upsertPlan once", async () => {
    api.upsertPlan.mockResolvedValueOnce(planResponse());

    const { result } = renderManager(coursesInFutureSemester);

    let outcome;
    await act(async () => {
      outcome = await result.current.manager.importSelectedCourses();
    });

    expect(outcome).toEqual({ imported: 2, skipped: 0 });
    expect(api.upsertPlan).toHaveBeenCalledTimes(1);
    const [, payload] = api.upsertPlan.mock.calls[0];
    expect(payload.placements).toHaveLength(2);
    expect(payload.placements[0]).toMatchObject({
      placementId: "course-ABC",
      type: "course",
      semester: "HS49",
      categoryPath: "Core",
      courseId: "ABC",
    });
  });

  it("returns imported=0 with no API call when there is nothing to import", async () => {
    const { result } = renderManager((set) => {
      set(unifiedCourseDataState, {
        semesters: {},
        selectedSemester: null,
        latestValidTerm: null,
      });
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.manager.importSelectedCourses();
    });

    expect(outcome).toEqual({ imported: 0, skipped: 0 });
    expect(api.upsertPlan).not.toHaveBeenCalled();
    expect(mockToast.info).toHaveBeenCalled();
  });

  it("errors out and toasts when no active plan is set", async () => {
    const { result } = renderManager((set) => {
      set(curriculumPlansRegistryState, {
        activePlanId: null,
        plans: {},
        schemaVersion: 1,
        isLoaded: true,
        isDirty: false,
      });
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.manager.importSelectedCourses();
    });

    expect(outcome).toEqual({ imported: 0, skipped: 0 });
    expect(mockToast.error).toHaveBeenCalled();
    expect(api.upsertPlan).not.toHaveBeenCalled();
  });
});
