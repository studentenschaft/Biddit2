import { describe, expect, it } from "vitest";

import { toZurichIso } from "../zurichTime.js";

describe("toZurichIso", () => {
  it("switches to CEST on the 2027 spring transition day", () => {
    expect(toZurichIso("2027-03-27", "09:15")).toBe("2027-03-27T09:15:00+01:00");
    expect(toZurichIso("2027-03-28", "09:15")).toBe("2027-03-28T09:15:00+02:00");
  });

  it("switches back to CET on the 2027 autumn transition day", () => {
    expect(toZurichIso("2027-10-30", "15:15")).toBe("2027-10-30T15:15:00+02:00");
    expect(toZurichIso("2027-10-31", "15:15")).toBe("2027-10-31T15:15:00+01:00");
  });
});
