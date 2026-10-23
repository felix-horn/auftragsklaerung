import { defineConfig } from "orval";

export default defineConfig({
  minimalHttpServer: {
    input: { target: "./minimal-http-server.openapi.json" },
    output: {
      mode: "single",
      target: "./minimal-http-server.generated.ts",
      client: "zod",
      override: { zod: { generateEachHttpStatus: true } },
    },
  },
});
