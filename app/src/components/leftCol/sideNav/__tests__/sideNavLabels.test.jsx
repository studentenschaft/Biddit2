/**
 * The side nav renders from one item list in two variants.
 *
 * The desktop rail is icon-only, as it always was — six glyphs in a green
 * column, each carrying its name only in `aria-label`. That is what the mobile
 * drawer could not reuse: an unexplained icon column is not a menu a
 * first-time phone user can read, so the drawer asks for `showLabels` and
 * every entry grows a visible label.
 *
 * What is pinned here is that the two variants stay in sync — same entries,
 * same wording — and that the label lives *inside* the button or link rather
 * than beside it, so the whole row is one ~44px tap target instead of a small
 * icon with dead text next to it.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecoilRoot } from "recoil";
import SideNav from "../SideNav";
import { NAV_LABELS } from "../navItem";
import { coursesTakenForRatingState } from "../../../recoil/coursesTakenForRatings";

vi.mock("@azure/msal-react", async () => {
  const { Fragment } = await import("react");
  return {
    // The nav entries under test do not depend on the auth state, only on
    // being rendered at all.
    AuthenticatedTemplate: Fragment,
    useMsal: () => ({
      instance: {
        getActiveAccount: () => ({ username: "test@unisg.ch" }),
        getAllAccounts: () => [{ username: "test@unisg.ch" }],
        logoutRedirect: vi.fn(),
      },
    }),
  };
});

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

const ENTRIES = [
  NAV_LABELS.review,
  NAV_LABELS.about,
  NAV_LABELS.privacy,
  NAV_LABELS.analytics,
  NAV_LABELS.contact,
  NAV_LABELS.logout,
];

const renderSideNav = (props) =>
  render(
    // Seeded, or the atom falls back to its async network selector and the
    // ratings entry never gets past the Suspense fallback.
    <RecoilRoot
      initializeState={({ set }) => set(coursesTakenForRatingState, [])}
    >
      <SideNav {...props} />
    </RecoilRoot>,
  );

/** The button or link for an entry, whichever element it happens to be. */
const entryFor = (label) => {
  const name = new RegExp(`^${label}`);
  return (
    screen.queryByRole("button", { name }) ?? screen.getByRole("link", { name })
  );
};

describe("side nav rail (default)", () => {
  it("covers every entry the nav declares", () => {
    // The drawer renders whatever SideNav renders, so an entry added to
    // NAV_LABELS but not to this list would go untested in both variants.
    expect(ENTRIES).toHaveLength(Object.keys(NAV_LABELS).length);
    expect(ENTRIES).toHaveLength(6);
  });

  it("shows no visible labels", () => {
    renderSideNav();
    ENTRIES.forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it("still names every entry for assistive technology", () => {
    renderSideNav();
    ENTRIES.forEach((label) => {
      expect(entryFor(label)).toBeInTheDocument();
    });
  });
});

describe("side nav with labels", () => {
  it("shows the same entries with visible text", () => {
    renderSideNav({ showLabels: true });
    ENTRIES.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("puts each label inside its own interactive row", () => {
    renderSideNav({ showLabels: true });
    ENTRIES.forEach((label) => {
      const row = entryFor(label);
      // Beside the control rather than inside it, the text would be an
      // untappable decoration next to a 40px icon.
      expect(within(row).getByText(label)).toBeInTheDocument();
    });
  });

  it("gives each row a full-width, thumb-sized hit area", () => {
    renderSideNav({ showLabels: true });
    ENTRIES.forEach((label) => {
      const className = entryFor(label).className;
      expect(className).toContain("w-full");
      expect(className).toContain("min-h-[44px]");
    });
  });

  it("drops the redundant aria-label where the text is visible", () => {
    renderSideNav({ showLabels: true });
    // Two names for one control is how they drift apart.
    ENTRIES.forEach((label) => {
      expect(entryFor(label)).not.toHaveAttribute("aria-label");
    });
  });
});
