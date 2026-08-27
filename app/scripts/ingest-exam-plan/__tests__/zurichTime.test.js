import { describe, expect, it } from "vitest";

import { toZurichIso, zurichUtcOffset } from "../zurichTime.js";

describe("zurichUtcOffset", () => {
  it("is +01:00 during the winter exam period", () => {
    expect(zurichUtcOffset("2027-01-18")).toBe("+01:00");
  });

  it("is +02:00 during the summer exam period", () => {
    expect(zurichUtcOffset("2027-06-10")).toBe("+02:00");
  });

  it("switches to CEST on the 2027 spring transition day", () => {
    expect(zurichUtcOffset("2027-03-27")).toBe("+01:00");
    expect(zurichUtcOffset("2027-03-28")).toBe("+02:00");
  });

  it("switches back to CET on the 2027 autumn transition day", () => {
    expect(zurichUtcOffset("2027-10-30")).toBe("+02:00");
    expect(zurichUtcOffset("2027-10-31")).toBe("+01:00");
  });

  it("refuses to guess for a date that is not a date", () => {
    expect(() => zurichUtcOffset("not-a-date")).toThrow();
  });
});

describe("toZurichIso", () => {
  it("combines date and wall-clock slot with the offset of that day", () => {
    expect(toZurichIso("2027-01-18", "09:15")).toBe("2027-01-18T09:15:00+01:00");
    expect(toZurichIso("2027-06-10", "15:15")).toBe("2027-06-10T15:15:00+02:00");
  });
});
