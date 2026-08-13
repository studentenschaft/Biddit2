import { describe, expect, it } from "vitest";
import { TAB, TAB_ORDER, tabIndexOf, tabIdAt } from "../tabs";

describe("tab constants", () => {
  it("orders every tab exactly once", () => {
    expect(new Set(TAB_ORDER).size).toBe(TAB_ORDER.length);
    expect(TAB_ORDER.length).toBe(Object.keys(TAB).length);
  });

  it("maps ids to indices and back", () => {
    TAB_ORDER.forEach((id, i) => {
      expect(tabIndexOf(id)).toBe(i);
      expect(tabIdAt(i)).toBe(id);
    });
  });

  it("falls back to the first tab for unknown values", () => {
    expect(tabIndexOf("nonsense")).toBe(0);
    expect(tabIdAt(99)).toBe(TAB_ORDER[0]);
  });
});
