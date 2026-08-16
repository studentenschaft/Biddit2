// Single definition of "is this a phone-sized viewport", shared by the
// components that have to make that call in JS rather than with a Tailwind
// class. The query mirrors Tailwind's md breakpoint (768px), so JS-gated and
// CSS-gated mobile behaviour switch at exactly the same width.
//
// matchMedia is feature-detected: jsdom does not implement it, and a missing
// implementation must read as "not mobile" rather than throw.
export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export const isMobileViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(MOBILE_MEDIA_QUERY).matches;

export default isMobileViewport;
