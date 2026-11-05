import { defineConfig } from "orval";

// Zod schemas from the OpenAPI documents of outside systems (contracts/),
// one copy per side of the contract: src/generated/ for our application,
// mock-erp/generated/ for the mock ERP, so neither imports the other's
// code; the document is the only link. Run: npm run erp:generate. The
// generated files are committed; never edit them by hand. When the ERP team sends a new
// document: CLAUDE.md, ERP contract (Module 4.5), the numbered steps.
//
// TODO(when @hey-api/openapi-ts supports TypeScript 7): switch the Zod
// generation from orval to hey-api. hey-api keeps the component names of
// the OpenAPI document (zCustomer, zOrder, zErrorResponse); orval names its
// schemas after operationId and status code (GetOrder200Response).
// Not done in Module 4.5: @hey-api/openapi-ts 0.99.0 crashes on start
// under TypeScript 7 ("Cannot read properties of undefined (reading
// 'AnyKeyword')"), because TypeScript 7's npm package no longer exports
// the compiler API it uses, and as a peer dependency it always gets the
// repo's TypeScript (npm overrides refuse: ERESOLVE).
// When a release supports it:
// 1. Check: `npm view @hey-api/openapi-ts peerDependencies` and the
//    release notes name TypeScript 7; then, on a throwaway branch,
//    `npm install --save-dev --save-exact @hey-api/openapi-ts@<version>`
//    and run `npx openapi-ts -i <document> -o <folder> -p zod`. It must
//    start without the error above and its output must pass
//    `npx tsc --noEmit`.
// 2. Compare its output with orval's for every OpenAPI document this
//    repo generates from: the same checks per field (regex, enum, nullable
//    dates, non-strict objects), only the names may differ. hey-api
//    writes no schema per status code: a 404 body is checked with the
//    component schema (zErrorResponse).
// 3. Switch: a hey-api config with only the zod plugin per document,
//    regenerate, update the imports that use orval's names, then
//    `npm uninstall orval` and delete the orval configs (this one and
//    04_module/minimal-http-server.orval.config.ts) and the files orval
//    generated. `npx tsc --noEmit` and `npm test` must pass, and the
//    diff of the generated files is reviewed in the same commit.
export default defineConfig({
  // The ERP team's document (Module 4.5). src/erp-contract.ts gives the
  // generated schemas the names our code uses.
  erp: {
    input: { target: "./contracts/erp-api.json" },
    output: {
      mode: "single",
      target: "./src/generated/erp-api.ts",
      client: "zod",
      override: { zod: { generateEachHttpStatus: true } },
    },
  },
  // The same document for the mock ERP (mock-erp/), which stands in for the
  // ERP's side of the contract. It uses orval's names directly.
  erpMock: {
    input: { target: "./contracts/erp-api.json" },
    output: {
      mode: "single",
      target: "./mock-erp/generated/erp-api.ts",
      client: "zod",
      override: { zod: { generateEachHttpStatus: true } },
    },
  },
});
