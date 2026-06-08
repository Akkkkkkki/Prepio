import { useLayoutEffect, useState } from "react";

export type MobileFooterRef = (element: HTMLDivElement | null) => void;

export interface UseMobileFooterHeightResult {
  height: number;
  setRef: MobileFooterRef;
}

/**
 * Tracks the rendered height of a fixed mobile footer so callers can reserve
 * matching bottom padding on their scroll container. Disable via `enabled`
 * when the footer isn't mounted (desktop, signed-out, off-step) — height
 * resets to 0 so the consumer drops its reserved space.
 */
export function useMobileFooterHeight(enabled: boolean): UseMobileFooterHeightResult {
  const [height, setHeight] = useState(0);
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setHeight(0);
      return;
    }

    if (!element) return;

    const measure = () => {
      setHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    measure();

    const handleResize = () => measure();
    window.addEventListener("resize", handleResize);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(element);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [enabled, element]);

  return { height, setRef: setElement };
}
