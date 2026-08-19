import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useHorizontalScrollAffordance } from "../useHorizontalScrollAffordance";

// --- ResizeObserver mock ---
let resizeObserverInstances = [];

class MockResizeObserver {
  constructor(cb) {
    this.callback = cb;
    this._observed = [];
    resizeObserverInstances.push(this);
  }
  observe(el) {
    this._observed.push(el);
  }
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// --- Test component that exposes hook state via data attributes ---
function TestComponent() {
  const { scrollContainerRef, canScrollLeft, canScrollRight } =
    useHorizontalScrollAffordance();

  return (
    <div
      ref={scrollContainerRef}
      data-testid="scroll-container"
      data-can-scroll-left={String(canScrollLeft)}
      data-can-scroll-right={String(canScrollRight)}
    >
      <div data-testid="inner-grid">content</div>
    </div>
  );
}

// Helper to mock scroll dimensions on an element
function mockScrollDimensions(el, { scrollWidth, clientWidth, scrollLeft }) {
  Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(el, "scrollLeft", { value: scrollLeft, configurable: true, writable: true });
}

function getState(container) {
  const el = container.querySelector("[data-testid='scroll-container']");
  return {
    canScrollLeft: el.getAttribute("data-can-scroll-left") === "true",
    canScrollRight: el.getAttribute("data-can-scroll-right") === "true",
    el,
  };
}

describe("useHorizontalScrollAffordance", () => {
  beforeEach(() => {
    resizeObserverInstances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for both directions when content fits container", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    // jsdom defaults scrollWidth/clientWidth to 0, so no overflow
    mockScrollDimensions(el, { scrollWidth: 500, clientWidth: 500, scrollLeft: 0 });

    // Trigger recheck via ResizeObserver
    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });

    const state = getState(container);
    expect(state.canScrollLeft).toBe(false);
    expect(state.canScrollRight).toBe(false);
  });

  it("returns canScrollRight=true when content overflows to the right", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    mockScrollDimensions(el, { scrollWidth: 1000, clientWidth: 500, scrollLeft: 0 });

    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });

    const state = getState(container);
    expect(state.canScrollRight).toBe(true);
    expect(state.canScrollLeft).toBe(false);
  });

  it("updates canScrollLeft=true after scrolling right", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    mockScrollDimensions(el, { scrollWidth: 1000, clientWidth: 500, scrollLeft: 0 });

    // Initial check
    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });

    // Simulate scroll
    Object.defineProperty(el, "scrollLeft", { value: 100, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    const state = getState(container);
    expect(state.canScrollLeft).toBe(true);
    expect(state.canScrollRight).toBe(true);
  });

  it("returns canScrollRight=false when scrolled to the end", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    mockScrollDimensions(el, { scrollWidth: 1000, clientWidth: 500, scrollLeft: 0 });

    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });

    // Scroll to end
    Object.defineProperty(el, "scrollLeft", { value: 500, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    const state = getState(container);
    expect(state.canScrollLeft).toBe(true);
    expect(state.canScrollRight).toBe(false);
  });

  it("re-checks on ResizeObserver callback when content width changes", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    // Initially no overflow
    mockScrollDimensions(el, { scrollWidth: 500, clientWidth: 500, scrollLeft: 0 });
    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });
    expect(getState(container).canScrollRight).toBe(false);

    // Content gets wider (e.g., columns expanded)
    Object.defineProperty(el, "scrollWidth", { value: 1000, configurable: true });
    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });

    expect(getState(container).canScrollRight).toBe(true);
  });

  it("observes both the scroll container and its first child", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);
    const innerGrid = el.firstElementChild;

    // The last created ResizeObserver should have observed both elements
    const observer = resizeObserverInstances[resizeObserverInstances.length - 1];
    expect(observer._observed).toContain(el);
    expect(observer._observed).toContain(innerGrid);
  });

  it("cleans up listeners and observer on unmount", () => {
    const { container, unmount } = render(<TestComponent />);
    const { el } = getState(container);

    const removeEventSpy = vi.spyOn(el, "removeEventListener");
    const observer = resizeObserverInstances[resizeObserverInstances.length - 1];

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("handles 2px threshold correctly at boundaries", () => {
    const { container } = render(<TestComponent />);
    const { el } = getState(container);

    // scrollLeft=2 is within threshold, should still be false
    mockScrollDimensions(el, { scrollWidth: 1000, clientWidth: 500, scrollLeft: 2 });
    act(() => {
      resizeObserverInstances.forEach((obs) => obs.callback());
    });
    expect(getState(container).canScrollLeft).toBe(false);

    // scrollLeft=3 exceeds threshold
    Object.defineProperty(el, "scrollLeft", { value: 3, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(getState(container).canScrollLeft).toBe(true);

    // At right edge within threshold: scrollLeft(498) + clientWidth(500) = 998, scrollWidth - 2 = 998
    Object.defineProperty(el, "scrollLeft", { value: 498, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(getState(container).canScrollRight).toBe(false);
  });
});
