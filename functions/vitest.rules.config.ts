import { defineConfig } from "vitest/config";

/**
 * Separate config for the Firestore-rules tests. They need the Firestore
 * emulator running (see {@code npm run test:rules}), so we keep them out
 * of the default {@code vitest run} that the per-app Cloud Build pipeline
 * uses.
 */
export default defineConfig({
  test: {
    include: ["test/firestore-rules.test.ts"],
    exclude: ["lib/**", "node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
