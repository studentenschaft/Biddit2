// tab_select belongs to the selectedTabAtom effect — the handler must stay silent.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TAB } from "../../constants/tabs";
import { trackTabSelect } from "../../components/helpers/analytics";
import { makeTabSelectHandler } from "../tabSelectHandler";

vi.mock("../../components/helpers/analytics", () => ({
  trackTabSelect: vi.fn(),
}));

describe("makeTabSelectHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the new tab id without emitting the event itself", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.COURSE_DETAILS, setSelectedTabState);
    handler(1); // index 1 = calendar in TAB_ORDER
    expect(setSelectedTabState).toHaveBeenCalledWith(TAB.CALENDAR);
    expect(trackTabSelect).not.toHaveBeenCalled();
  });

  it("does not store a no-op select", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.CALENDAR, setSelectedTabState);
    handler(1);
    expect(setSelectedTabState).not.toHaveBeenCalled();
  });
});
