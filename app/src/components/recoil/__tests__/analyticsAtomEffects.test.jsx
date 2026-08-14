/**
 * The navigation events are emitted by atom effects, which makes every caller
 * reportable but also puts the emission on React's rendering path. These tests
 * pin the two properties that matter: no event for a no-op set, and exactly one
 * event per change even under StrictMode's double-invoked renders.
 */

import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { RecoilRoot, useSetRecoilState } from "recoil";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TAB } from "../../../constants/tabs";
import { trackColumnSwitch, trackTabSelect } from "../../helpers/analytics";
import { isLeftViewVisible } from "../isLeftViewVisible";
import { selectedTabAtom } from "../selectedTabAtom";

vi.mock("../../helpers/analytics", () => ({
  trackTabSelect: vi.fn(),
  trackColumnSwitch: vi.fn(),
}));

const setters = {};

const Probe = () => {
  setters.setTab = useSetRecoilState(selectedTabAtom);
  setters.setLeftVisible = useSetRecoilState(isLeftViewVisible);
  return null;
};

const renderProbe = ({ strict = false } = {}) => {
  const tree = (
    <RecoilRoot>
      <Probe />
    </RecoilRoot>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe("navigation atom telemetry effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits one tab_select per change, with the previous tab", () => {
    renderProbe();

    act(() => setters.setTab(TAB.CALENDAR));

    expect(trackTabSelect).toHaveBeenCalledTimes(1);
    expect(trackTabSelect).toHaveBeenCalledWith(TAB.CALENDAR, TAB.SUMMARY);
  });

  it("stays silent when the same tab is set again", () => {
    renderProbe();

    act(() => setters.setTab(TAB.CALENDAR));
    act(() => setters.setTab(TAB.CALENDAR));

    expect(trackTabSelect).toHaveBeenCalledTimes(1);
  });

  it("does not double-count under StrictMode", () => {
    renderProbe({ strict: true });

    act(() => setters.setTab(TAB.CALENDAR));

    expect(trackTabSelect).toHaveBeenCalledTimes(1);
  });

  it("emits one column_switch per change", () => {
    renderProbe();

    act(() => setters.setLeftVisible(true));
    expect(trackColumnSwitch).toHaveBeenCalledTimes(1);
    expect(trackColumnSwitch).toHaveBeenCalledWith(true);

    act(() => setters.setLeftVisible(true));
    expect(trackColumnSwitch).toHaveBeenCalledTimes(1);
  });
});
