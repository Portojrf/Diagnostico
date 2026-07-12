import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const getBreakpoint = (w: number): Breakpoint => {
  if (w >= 1024) return "desktop";
  if (w >= 720) return "tablet";
  return "mobile";
};

export function useResponsive() {
  const [width, setWidth] = useState<number>(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  const bp = getBreakpoint(width);
  return {
    width,
    bp,
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
  };
}
