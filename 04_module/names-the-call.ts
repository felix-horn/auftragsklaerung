// Module 4.1, part 1: the model names a function; our code decides what happens.
// One request to Anthropic. The result of the function never goes back to the
// model.
//   npx tsx 04_module/names-the-call.ts             fake Anthropic, no API call
//   REAL_API=1 npx tsx 04_module/names-the-call.ts  one real call
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { fakeAnthropic, loggingFetch } from "./wire.js";

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

// For the fake: the shape of Anthropic's round-1 answer in your Module 1 run,
// with the thinking block left out and the field names of this tool.
const preparedRound1 = {
  id: "msg_fake_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [
    {
      type: "tool_use",
      id: "toolu_fake_1",
      name: "getOrderStatus",
      input: { orderNumber: "44821" },
    },
  ],
  stop_reason: "tool_use",
  stop_sequence: null,
  usage: { input_tokens: 476, output_tokens: 81 },
};

const realApi = process.env.REAL_API === "1";
const anthropic = createAnthropic({
  // The fake needs no key; the real call reads ANTHROPIC_API_KEY from .env.
  apiKey: realApi ? undefined : "not-used-by-the-fake",
  fetch: loggingFetch(realApi ? fetch : fakeAnthropic([preparedRound1])),
});

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