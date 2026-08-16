/**
 * Shared look and wording for the side-nav entries.
 *
 * The side nav renders in two variants from one item list: the desktop rail
 * (icon only, the historical look) and the mobile drawer (icon + visible
 * label). Both variants come from here so a label can never disagree with the
 * `aria-label` the icon-only variant exposes for the same entry.
 */

/** The accessible name of each entry, and its visible text in label mode. */
export const NAV_LABELS = {
  review: "Rate courses",
  about: "About",
  privacy: "Privacy",
  contact: "Contact",
  logout: "Log out",
  // "Analytics settings" verbatim: SideNav.test.jsx, sideNavDialogStacking
  // and the AnalyticsNotice copy ("Analytics settings (chart icon)") all name
  // this entry, so the drawer label has to be the same string.
  analytics: "Analytics settings",
};

const INTERACTIVE =
  "text-white rounded-md hover:bg-hsg-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white active:bg-hsg-800";

/**
 * Classes for one nav entry. The label variant is a full-width row with a
 * ~44px tap target — the whole row is the button/link, so the text is part of
 * the hit area rather than sitting next to it.
 */
export const navItemClassName = (showLabel) =>
  showLabel
    ? `flex w-full items-center gap-3 px-3 py-2.5 min-h-[44px] text-left ${INTERACTIVE}`
    : `inline-flex items-center justify-center p-2 ${INTERACTIVE}`;
