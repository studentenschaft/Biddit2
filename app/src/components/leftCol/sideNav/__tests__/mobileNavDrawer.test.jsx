/**
 * The mobile side-nav drawer.
 *
 * Below md the side nav was an ordinary flex child of the app's `flex-col`
 * root, so "opening" it merely un-hid a full-width green block *above* the
 * content and pushed the whole app down half a phone viewport. There was no
 * backdrop and no way to dismiss it by tapping outside.
 *
 * jsdom computes no layout, so what is pinned here is what actually broke: the
 * drawer overlays rather than occupies flow, it is dismissible from outside
 * itself, and it stacks in the one narrow band that works — above every
 * in-page layer including the fixed z-50 one (AnalyticsNotice, StudyondBanner),
 * below the toggle that closes it and below the z-[60] dialogs its own entries
 * open.
 *
 * It is also deliberately *not* a modal: it contains the Review and About
 * triggers, each of which opens a Headless UI Dialog with a focus trap of its
 * own, so the drawer claims no dialog semantics it cannot back with a trap.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecoilRoot } from "recoil";
import MobileNavDrawer from "../MobileNavDrawer";
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

/** The layer the side-nav dialogs declare — see sideNavDialogStacking. */
const DIALOG_Z_INDEX = 60;

/**
 * The layer the app's in-page fixed elements share — AnalyticsNotice (the
 * cookie notice) and StudyondBanner among them. The drawer has to clear it.
 */
const IN_PAGE_FIXED_Z_INDEX = 50;

/**
 * The mobile menu toggle's layer, read from the page that renders it. Matched
 * off the toggle's own className rather than the first z- in sight, so the
 * ladder written up in the comment above it cannot answer for it.
 */
const toggleZIndex = () => {
  const [source] = Object.values(
    import.meta.glob("../../../../pages/Biddit2.jsx", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
  );
  return Number(
    source.match(
      /Mobile Menu Button[\s\S]*?className="[^"]*?\bz-\[?(\d+)\]?/,
    )[1],
  );
};

const renderDrawer = (props = {}) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => set(coursesTakenForRatingState, [])}
    >
      <MobileNavDrawer open onClose={vi.fn()} {...props} />
    </RecoilRoot>,
  );

const backdrop = () => screen.getByRole("button", { name: "Close menu" });
const panel = () => screen.getByRole("navigation", { name: "App menu" });

const layerOf = (element) =>
  Number(element.className.match(/z-\[?(\d+)\]?/)[1]);

describe("mobile nav drawer", () => {
  it("renders nothing while closed", () => {
    renderDrawer({ open: false });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the labelled nav entries when open", () => {
    renderDrawer();
    Object.values(NAV_LABELS).forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("overlays the page instead of taking space in it", () => {
    renderDrawer();
    // In flow, the panel shoved the entire app down the viewport.
    expect(panel().className).toContain("fixed");
    expect(backdrop().className).toContain("fixed");
    expect(panel().className).toContain("inset-y-0");
    expect(panel().className).toContain("left-0");
  });

  it("stays off the desktop layout entirely", () => {
    const { container } = renderDrawer();
    expect(container.firstChild.className).toContain("md:hidden");
  });

  it("closes when the backdrop is tapped", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.click(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops listening for Escape once closed", () => {
    const onClose = vi.fn();
    const { rerender } = renderDrawer({ onClose });
    rerender(
      <RecoilRoot
        initializeState={({ set }) => set(coursesTakenForRatingState, [])}
      >
        <MobileNavDrawer open={false} onClose={onClose} />
      </RecoilRoot>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dims the page behind it with a real, reachable control", () => {
    renderDrawer();
    // A div with an onClick is invisible to the keyboard and to AT; the
    // tap-outside-to-close affordance has to be a button.
    expect(backdrop().tagName).toBe("BUTTON");
    expect(backdrop().className).toMatch(/bg-black\/\d+/);
  });

  it("stacks the panel above its backdrop, both below the toggle", () => {
    renderDrawer();
    expect(layerOf(backdrop())).toBeLessThan(layerOf(panel()));
    // The toggle is the drawer's other close control and must stay tappable;
    // the side-nav dialogs open *from* the drawer and must paint over it.
    expect(layerOf(panel())).toBeLessThan(toggleZIndex());
    expect(toggleZIndex()).toBeLessThan(DIALOG_Z_INDEX);
  });

  it("covers the in-page fixed layer the cookie notice sits on", () => {
    renderDrawer();
    // AnalyticsNotice is a fixed z-50 banner: with the drawer band beneath it,
    // the notice painted straight through the backdrop.
    expect(layerOf(backdrop())).toBeGreaterThan(IN_PAGE_FIXED_Z_INDEX);
    expect(layerOf(panel())).toBeGreaterThan(IN_PAGE_FIXED_Z_INDEX);
  });

  it("claims no modal semantics it cannot back with a focus trap", () => {
    renderDrawer();
    expect(panel().tagName).toBe("NAV");
    expect(panel()).not.toHaveAttribute("role", "dialog");
    expect(panel()).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
