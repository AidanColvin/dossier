import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test config for the deterministic summary generators. The @/ alias mirrors
// tsconfig so tests import the same way the app does. jsdom is not needed:
// these are pure functions over plain data.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
