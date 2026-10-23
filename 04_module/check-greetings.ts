// Module 4.5, part 2: the Zod schema orval generated from
// minimal-http-server.openapi.json, used on its own. No server, no
// network, no API call: the bodies are typed in below. The first two are
// what the server sent in part 1, the other three are invented.
//
// Run: npx tsx 04_module/check-greetings.ts

import { z } from "zod";
import { GetHello200Response } from "./minimal-http-server.generated.js";

const bodies = [
  '{"message":"Hallo Felix"}',
  '{"message":"Hallo Welt"}',
  '{"msg":"Hallo"}',
  '{"message":42}',
  '{"message":"Hallo","lang":"de"}',
];

for (const body of bodies) {
  const result = GetHello200Response.safeParse(JSON.parse(body));
  if (result.success) {
    // result.data is the parsed body: only the properties the schema
    // knows, anything else is left out.
    console.log(`fits    ${body}  parsed: ${JSON.stringify(result.data)}`);
  } else {
    console.log(`breaks  ${body}`);
    console.log(z.prettifyError(result.error));
  }
}
