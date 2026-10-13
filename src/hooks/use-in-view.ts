"use client";

import { useCallback, useState } from "react";

// Becomes true the first time the element gets near the viewport, and stays
// true: for heavy content that should load only when the user scrolls to it.
export function useInView<T extends Element>(rootMargin = "200px") {
  const [inView, setInView] = useState(false);
  const ref = useCallback(
    (element: T | null) => {
      if (element === null || inView) return;
      if (!("IntersectionObserver" in window)) {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin }
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    [inView, rootMargin]
  );
  return [ref, inView] as const;
}
