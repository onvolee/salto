import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "salto-src": fileURLToPath(new URL("./src", import.meta.url)),
      "@salto/core/testing": fileURLToPath(new URL("../../packages/core/src/testing.ts", import.meta.url)),
      "@salto/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
