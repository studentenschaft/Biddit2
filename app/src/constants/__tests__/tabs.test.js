import { describe, expect, it } from "vitest";
import {
  TAB,
  TAB_GROUPS,
  TAB_LABELS,
  TAB_ORDER,
  tabIndexOf,
  tabIdAt,
} from "../tabs";

describe("tab constants", () => {
  it("orders every tab exactly once", () => {
    expect(new Set(TAB_ORDER).size).toBe(TAB_ORDER.length);
    expect(TAB_ORDER.length).toBe(Object.keys(TAB).length);
    expect(new Set(TAB_ORDER)).toEqual(new Set(Object.values(TAB)));
  });

  it("maps ids to indices and back", () => {
    TAB_ORDER.forEach((id, i) => {
      expect(tabIndexOf(id)).toBe(i);
      expect(tabIdAt(i)).toBe(id);
    });
  });

  it("labels every ordered tab exactly once", () => {
    expect(Object.keys(TAB_LABELS).sort()).toEqual([...TAB_ORDER].sort());
  });

  it("groups exactly the ordered tabs, in order", () => {
    expect(TAB_GROUPS.flatMap(({ tabs }) => tabs)).toEqual(TAB_ORDER);
  });

  it("falls back to the first tab for unknown values", () => {
    expect(tabIndexOf("nonsense")).toBe(0);
    expect(tabIdAt(99)).toBe(TAB_ORDER[0]);
  });
});
