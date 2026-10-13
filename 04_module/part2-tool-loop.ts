// Module 4.1, part 2: the SDK runs the loop.
// The tool now has an `execute` function, so the SDK runs it. Whether the
// result goes back to the model is decided by `stopWhen`:
//   A: default, one request. The SDK runs the function, the model never sees
//      the result (as in part 1, except that the SDK runs the function
//      instead of our code).
//   B: stopWhen: isStepCount(5). After the function ran, the SDK sends a
//      second request with the whole history, result included: your Module 1
//      round 2, written for us.
//   npx tsx 04_module/sdk-loop.ts   three requests: 1 for A, 2 for B
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

// The tool from part 1, plus `execute`: the SDK calls it with the input the
// model asked for, and keeps what it returns as the tool result.
const getOrderStatusTool = tool({
    description:
        "Look up the current shipping/processing status of a customer order by its order number.",
    inputSchema: z.object({
        orderNumber: z.string().describe("The order number, e.g. '44821'."),
    }),
    execute: async ({ orderNumber }) => getOrderStatus(orderNumber),
});

const anthropic = createAnthropic({ fetch: loggingFetch });

async function run(label: string, loop: boolean) {
    console.log(`\n========== ${label} ==========`);
    const result = await generateText({
        model: anthropic("claude-sonnet-5"),
        tools: { getOrderStatus: getOrderStatusTool },
        messages: [{ role: "user", content: "Where is my order 44821?" }],
        maxOutputTokens: 500,
        ...(loop ? { stopWhen: isStepCount(5) } : {}),
    });

    // One step = one request to Anthropic plus the tools the SDK ran after it.
    console.log("--- what generateText returned, step by step ---");
    result.steps.forEach((step, i) => {
        console.log(`step ${i + 1}: finishReason ${step.finishReason}`);
        console.log("  text:", JSON.stringify(step.text));
        for (const call of step.toolCalls) {
            console.log("  tool call:", call.toolName, call.input);
        }
        for (const toolResult of step.toolResults) {
            console.log("  tool result:", JSON.stringify(toolResult.output));
        }
    });
}

await run("A: default (no stopWhen)", false);
await run("B: stopWhen: isStepCount(5)", true);