// Module 4.1, part 2: the same tool loop, run by the SDK.
// Compare with part1-loop-by-hand.ts: same requests, same answer. What
// disappeared from this file is what the SDK does for us.
//   npx tsx 04_module/part2-loop-by-sdk.ts   two requests
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, isStepCount, tool } from "ai";
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

// With `execute`, the SDK runs the function when the model asks for it.
const getOrderStatusTool = tool({
    description:
        "Look up the current shipping/processing status of a customer order by its order number.",
    inputSchema: z.object({
        orderNumber: z.string().describe("The order number, e.g. '44821'."),
    }),
    execute: async ({ orderNumber }) => getOrderStatus(orderNumber),
});

const anthropic = createAnthropic({ fetch: loggingFetch });

const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    tools: { getOrderStatus: getOrderStatusTool },
    messages: [{ role: "user", content: "Where is my order 44821?" }],
    maxOutputTokens: 500,
    // At most five requests; without stopWhen the SDK sends only one.
    stopWhen: isStepCount(5),
});

console.log("--- answer ---");
console.log(result.text);