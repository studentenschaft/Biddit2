import { beforeEach, describe, expect, it, vi } from "vitest";
import ReactGA from "react-ga4";
import { TAB } from "../../constants/tabs";
import { makeTabSelectHandler } from "../tabSelectHandler";

vi.mock("react-ga4", () => ({ default: { event: vi.fn() } }));

describe("makeTabSelectHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the new tab id and reports the transition", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.COURSE_DETAILS, setSelectedTabState);
    handler(1); // index 1 = calendar in TAB_ORDER
    expect(setSelectedTabState).toHaveBeenCalledWith(TAB.CALENDAR);
    expect(ReactGA.event).toHaveBeenCalledWith("tab_select", {
      from: TAB.COURSE_DETAILS,
      to: TAB.CALENDAR,
    });
  });

  it("does not report a no-op select", () => {
    const setSelectedTabState = vi.fn();
    const handler = makeTabSelectHandler(TAB.CALENDAR, setSelectedTabState);
    handler(1);
    expect(ReactGA.event).not.toHaveBeenCalled();
    expect(setSelectedTabState).not.toHaveBeenCalled();
  });
});
