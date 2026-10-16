// Module 4.1, part 1: the tool loop written by hand.
// The SDK only builds each request and reads each answer; the loop is ours,
// as in Module 1. Compare with part2-loop-by-sdk.ts: same requests, same
// answer.
//   npx tsx 04_module/part1-loop-by-hand.ts   two requests
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool, type ModelMessage } from "ai";
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

// A second function, only to show where a second tool goes. Fixed answer.
function checkStockLevel(partNumber: string): string {
  return `${partNumber}: 120 in stock`;
}

// No `execute` functions: the SDK runs nothing, our loop below does.
const tools = {
  getOrderStatus: tool({
    description:
      "Look up the current shipping/processing status of a customer order by its order number.",
    inputSchema: z.object({
      orderNumber: z.string().describe("The order number, e.g. '44821'."),
    }),
  }),
  checkStockLevel: tool({
    description: "Look up how many units of a part are in stock.",
    inputSchema: z.object({
      partNumber: z.string().describe("The part number, e.g. '7745-B'."),
    }),
  }),
  // no additional `execute` property to otherwise same as `getOrderStatusTool` in part2-loop-by-sdk.ts

};

const anthropic = createAnthropic({ fetch: loggingFetch });

// Almost the same as part2-loop-by-sdk.ts

// The whole conversation; every request sends all of it.
const messages: ModelMessage[] = [
  { role: "user", content: "Where is my order 44821?" },
];

// At most five requests, so a model that keeps asking for tools can't loop
// forever.
for (let round = 1; round <= 5; round++) {
  const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    tools,
    messages,
    maxOutputTokens: 500,
  });

  // Append the model's turn as it came back: thinking, text and tool calls.
  messages.push(...result.responseMessages);

  // No tool requested: this is the answer. Stopping after round 1 instead,
  // whatever the model asked for, would be "the model names the call, our
  // code acts on it": the result would never reach the model.
  if (result.finishReason !== "tool-calls") {
    console.log("--- answer ---");
    console.log(result.text);
    break;
  }

  // Run every function the model asked for and append the results as one
  // tool message. toolCallId ties each result to its request.
  messages.push({
    role: "tool",
    content: result.staticToolCalls.map((call) => {
      // Which function to run is our code's job: we look at the tool's name.
      let value: string;
      switch (call.toolName) {
        case "getOrderStatus":
          value = getOrderStatus(call.input.orderNumber);
          break;
        case "checkStockLevel":
          value = checkStockLevel(call.input.partNumber);
          break;
      }
      return {
        type: "tool-result" as const,
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: { type: "text" as const, value },
      };
    }),
  });
}