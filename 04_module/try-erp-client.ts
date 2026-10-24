// Module 4.5, part 5: the ERP stage with the HTTP client, against whatever
// answers at ERP_BASE_URL (.env). No API call.
//
// Start the mock ERP first, in a second terminal:  npm run erp
// Then:  npx tsx 04_module/try-erp-client.ts
//
// The senders are the mock's seed addresses (mock-erp/data.json) and one
// address the seed doesn't have. The order numbers are typed in, as the
// extraction would have recorded them; no email is read, no model asked.

import "dotenv/config";
import { loadConfig } from "../src/config.js";
import { createErpClient } from "../src/erp-client.js";
import { runErpStage } from "../src/erp-stage.js";

const config = loadConfig();
const erp = createErpClient(config.erpBaseUrl);

const lookups = [
  // A contact of K-51320, written with capitals (R-14 ignores case), asks
  // about its two orders; "44100" without prefix (R-15).
  {
    senderAddress: "L.Vogt@kessler-fluidtechnik.example",
    orderNumbers: ["A-44821", "44100"],
  },
  // A contact of K-58047 asks about K-51320's order (R-16).
  {
    senderAddress: "bestellung@wendt-maschinenbau.example",
    orderNumbers: ["A-44821"],
  },
  // An address no customer has (R-14).
  { senderAddress: "info@unbekannt.example", orderNumbers: ["A-44821"] },
];

console.log(`ERP at ${config.erpBaseUrl}`);
for (const input of lookups) {
  const result = await runErpStage(input, erp);
  console.log(`\n${input.senderAddress} asks about ${input.orderNumbers.join(", ")}`);
  console.log(JSON.stringify(result, null, 2));
}
