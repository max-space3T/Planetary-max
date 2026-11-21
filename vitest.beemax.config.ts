import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["run-all-beemax-tests.ts"],
  },
});
