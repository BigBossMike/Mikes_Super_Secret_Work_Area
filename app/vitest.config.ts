import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lets the tests use the same "@/..." imports as the app.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"] },
});
