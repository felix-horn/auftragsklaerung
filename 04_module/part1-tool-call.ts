// Module 4.1, part 1: the model names a function; our code decides what happens.
// One request to Anthropic. The result of the function never goes back to the
// model.
//   npx tsx 04_module/names-the-call.ts
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { loggingFetch } from "./logging-fetch.js";

// The ERP stand-in from Module 1, unchanged.
function getOrderStatus(orderNumber: string): string {
  const fakeOrders: Record<string, string> = {
    "44821": "shipped, arriving 2026-09-05",
    "44822": "processing, not yet shipped",
  };
  return fakeOrders[orderNumber] ?? `no order found with number ${orderNumber}`;
}

// The same tool as in Module 1, written for the SDK: Zod instead of the
// hand-written JSON Schema. The tool's name is its key in `tools` below.
// No `execute` function, so the SDK runs nothing: it only hands us what the
// model asked for.
const getOrderStatusTool = tool({
  description:
    "Look up the current shipping/processing status of a customer order by its order number.",
  inputSchema: z.object({
    orderNumber: z.string().describe("The order number, e.g. '44821'."),
  }),
});

const anthropic = createAnthropic({ fetch: loggingFetch });

const result = await generateText({
  model: anthropic("claude-sonnet-5"),
  tools: { getOrderStatus: getOrderStatusTool },
  messages: [{ role: "user", content: "Where is my order 44821?" }],
  maxOutputTokens: 500,
});

console.log("--- what generateText returned ---");
console.log("finishReason:", result.finishReason);
console.log("text:", JSON.stringify(result.text));
console.log(
  "toolCalls:",
  result.toolCalls.map(({ toolName, input }) => ({ toolName, input })),
);

// From here on it's our code. Here it runs the function and prints the
// result. The model never sees it: there is no second request.
// staticToolCalls holds the calls to tools declared above, with typed input.
for (const call of result.staticToolCalls) {
  if (call.toolName === "getOrderStatus") {
    console.log("--- our code runs the function ---");
    console.log(getOrderStatus(call.input.orderNumber));
  }
}           