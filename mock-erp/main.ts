// Starts the mock ERP: npm run erp. Runs until Ctrl+C.
// Reads mock-erp/data.json, checks it against the rules for the data file
// (mock-erp/data-schema.ts: the ERP contract plus lower case and nothing
// twice) and refuses to start if anything breaks them. Listens only on this
// machine.

import { readFileSync } from "node:fs";
import { z } from "zod";
import { mockErpDataSchema } from "./data-schema.js";
import { createMockErp } from "./server.js";

const PORT = 4100;

// The file next to this one, wherever the repo lives (the path may contain
// spaces).
const dataFile = new URL("./data.json", import.meta.url);
const result = mockErpDataSchema.safeParse(
  JSON.parse(readFileSync(dataFile, "utf8")),
);

if (!result.success) {
  console.error(
    "Not started: mock-erp/data.json breaks the rules in mock-erp/data-schema.ts.",
  );
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

const { customers, orders } = result.data;
createMockErp(result.data).listen(PORT, "127.0.0.1", () => {
  console.log(
    `Mock ERP on http://127.0.0.1:${PORT}: ${customers.length} customers, ${orders.length} orders`,
  );
});
