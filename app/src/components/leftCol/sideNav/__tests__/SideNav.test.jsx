/**
 * Wiring guard: both consent surfaces must actually be reachable from the side
 * nav. Their dialogs are covered by their own suites; this only pins that
 * SideNav still renders the triggers, under the aria-labels the notice, the
 * privacy copy and the stacking suite all refer to.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SideNav from "../SideNav";

// Ratings and logout pull in Recoil, MSAL and the router; neither is part of
// what this test asserts.
vi.mock("../ReviewButton", () => ({
  ReviewButton: () => <button aria-label="Ratings" />,
}));
vi.mock("../LogoutButton", () => ({
  __esModule: true,
  default: () => <button aria-label="Logout" />,
  LogoutButton: () => <button aria-label="Logout" />,
}));

describe("SideNav", () => {
  it.each(["Analytics settings", "Privacy"])(
    "offers the %s entry point",
    (label) => {
      render(<SideNav />);
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    },
  );
});
