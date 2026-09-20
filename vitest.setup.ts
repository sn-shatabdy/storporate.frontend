import "@testing-library/jest-dom/vitest";

/**
 * STOR-40 Phase 5 — JSDOM doesn't implement `window.matchMedia`, but the
 * advisor page (and its subcomponents) use `useIsBreakpoint(...)` to
 * drive layout decisions (e.g. the lg-only fallback for `selectedId`,
 * the `xl+` side-by-side grid vs `xl-` tabs). Without a stub,
 * `useIsBreakpoint` would permanently return `false`, breaking every
 * test that expects the lg desktop behavior (rail + workspace
 * side-by-side, auto-select first item when the URL has no param, etc.).
 *
 * The stub matches the desktop "lg but not xl" viewport that the page's
 * existing tests assume — `isLg` is true (rail + workspace side-by-side,
 * auto-select first item) but `isXl` is false (workspace renders tabs,
 * not the side-by-side grid). Tests that need different breakpoints
 * override `matchMedia` per-test.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => {
      // Match `(min-width: 1024px)` (lg) but NOT `(min-width: 1280px)`
      // (xl). Treat any non-`min-width` query (e.g. `max-width: 767px`)
      // as a no-match — the page never asks for those.
      const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
      const matches = minWidthMatch !== null && Number(minWidthMatch[1]) <= 1024;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}
