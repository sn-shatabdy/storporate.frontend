import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Vitest config — first test tooling in this repo (STOR-38 Phase 5). Uses
 * the React plugin (so JSX in `.tsx` test files just works), jsdom for the
 * DOM environment (needed by `@testing-library/react`), and the same `@/*`
 * → `./src/*` alias the Next.js tsconfig already has so test files can
 * import from `@/lib/...` / `@/components/...` the same way source code
 * does. The setup file wires up `@testing-library/jest-dom`'s matchers
 * (`toBeInTheDocument`, etc.) for the whole suite.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
});
