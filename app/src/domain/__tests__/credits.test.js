import { describe, it, expect } from "vitest";
import { toEcts, formatEcts } from "../credits";

describe("toEcts", () => {
  it("converts raw API credits (hundredths) to ECTS", () => {
    expect(toEcts(300)).toBe(3);
    expect(toEcts(450)).toBe(4.5);
  });

  it("passes values that are already ECTS through", () => {
    expect(toEcts(3)).toBe(3);
    expect(toEcts(0)).toBe(0);
  });

  it("returns the fallback for unknown credits", () => {
    expect(toEcts(null)).toBeNull();
    expect(toEcts(undefined)).toBeNull();
    expect(toEcts(undefined, 4)).toBe(4);
    expect(toEcts("n/a", 3)).toBe(3);
  });

  it("accepts numeric strings", () => {
    expect(toEcts("600")).toBe(6);
  });
});

describe("formatEcts", () => {
  it("renders unknown credits as ?", () => {
    expect(formatEcts(null)).toBe("?");
    expect(formatEcts(undefined)).toBe("?");
    expect(formatEcts(Number.NaN)).toBe("?");
  });

  it("renders whole and fractional values without padding", () => {
    expect(formatEcts(3)).toBe("3");
    expect(formatEcts(6)).toBe("6");
    expect(formatEcts(4.5)).toBe("4.5");
    expect(formatEcts(7.5)).toBe("7.5");
    expect(formatEcts(0)).toBe("0");
  });

  it("sheds float noise from sums", () => {
    expect(formatEcts(0.1 + 0.2)).toBe("0.3");
  });

  it("renders an exercise group with credits: 0 as 0, not a default", () => {
    expect(formatEcts(toEcts(0))).toBe("0");
  });
});
