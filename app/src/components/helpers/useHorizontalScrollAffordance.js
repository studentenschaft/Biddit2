import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Tracks horizontal scroll position and content overflow to drive
 * gradient fade affordances on a scrollable container.
 *
 * @returns {{ scrollContainerRef: React.RefObject, canScrollLeft: boolean, canScrollRight: boolean }}
 */
export function useHorizontalScrollAffordance() {
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    // 2px threshold avoids sub-pixel false positives
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Initial check
    checkScroll();

    // Passive scroll listener for performance
    el.addEventListener("scroll", checkScroll, { passive: true });

    // Observe both the container (window resize) and its content (column collapse/expand)
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    if (el.firstElementChild) {
      observer.observe(el.firstElementChild);
    }

    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [checkScroll]);

  return { scrollContainerRef, canScrollLeft, canScrollRight };
}
