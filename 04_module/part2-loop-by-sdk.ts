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

// A second function, only to show where a second tool goes. Fixed answer.
function checkStockLevel(partNumber: string): string {
    return `${partNumber}: 120 in stock`;
}

// With `execute`, the SDK runs the matching function when the model asks
// for a tool. Choosing it by name is the SDK's job here.
const tools = {
    getOrderStatus: tool({
        description:
            "Look up the current shipping/processing status of a customer order by its order number.",
        inputSchema: z.object({
            orderNumber: z.string().describe("The order number, e.g. '44821'."),
        }),
        execute: async ({ orderNumber }) => getOrderStatus(orderNumber),
    }),
    checkStockLevel: tool({
        description: "Look up how many units of a part are in stock.",
        inputSchema: z.object({
            partNumber: z.string().describe("The part number, e.g. '7745-B'."),
        }),
        // additional line to otherwise same as `getOrderStatusTool` in part1-loop-by-hand.ts
        execute: async ({ partNumber }) => checkStockLevel(partNumber),
    }),
};

const anthropic = createAnthropic({ fetch: loggingFetch });

// Almost the same as part1-loop-by-hand.ts

const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    tools,
    messages: [{ role: "user", content: "Where is my order 44821?" }],
    maxOutputTokens: 500,
    // At most five requests; without stopWhen the SDK sends only one.
    stopWhen: isStepCount(5),
});

console.log("--- answer ---");
console.log(result.text);