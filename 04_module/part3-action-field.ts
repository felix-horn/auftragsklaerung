// Module 4.1, part 3: the same loop without tools.
// No `tools` in the request. The model answers with JSON in a shape we
// define (as extractEmail does): one field names the next action, either a
// function of ours or "answer". Our code runs the function and sends the
// result back as an ordinary user message. Compare with part1-loop-by-hand.ts:
// same outcome, but everything the tool protocol provides is ours to build.
//   npx tsx 04_module/part3-action-field.ts   two requests
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output, type ModelMessage } from "ai";
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

// A second function, only to show where a second action goes. Fixed answer.
function checkStockLevel(partNumber: string): string {
    return `${partNumber}: 120 in stock`;
}

// The answer's shape. Each function needs an action value and a field for
// its input; every field is in every answer, null where it doesn't apply.
const nextStepSchema = z.object({
    action: z
        .enum(["getOrderStatus", "checkStockLevel", "answer"])
        .describe(
            "getOrderStatus: look up the current shipping/processing status of a customer order by its order number.checkStockLevel: look up how many units of a part are in stock. answer: reply to the customer.",
        ),
    orderNumber: z
        .string()
        .nullable()
        .describe(
            "For getOrderStatus: the order number, e.g. '44821'. Otherwise null.",
        ),
    partNumber: z
        .string()
        .nullable()
        .describe(
            "For checkStockLevel: the part number, e.g. '7745-B'. Otherwise null.",
        ),
    answer: z
        .string()
        .nullable()
        .describe("For answer: the reply to the customer. Otherwise null."),
});

// Without tools, nothing tells the model that it will get results back.
// With tools, Anthropic adds such an explanation itself.
const instructions =
    "Answer the customer's question. If you need data first, choose one lookup as the action; its result will arrive in the next message.";

const anthropic = createAnthropic({ fetch: loggingFetch });

// The whole conversation; every request sends all of it.
const messages: ModelMessage[] = [
    { role: "user", content: "Where is my order 44821?" },
];

// At most five requests, so a model that keeps asking for lookups can't
// loop forever.
for (let round = 1; round <= 5; round++) {
    const { output, responseMessages } = await generateText({
        model: anthropic("claude-sonnet-5"),
        instructions,
        output: Output.object({ schema: nextStepSchema }),
        messages,
        maxOutputTokens: 500,
    });

    // Append the model's turn: its JSON answer.
    messages.push(...responseMessages);

    if (output.action === "answer") {
        console.log("--- answer ---");
        console.log(output.answer);
        break;
    }

    // Run the function the model named. There is no tool_result and no id:
    // the result goes back as a plain user message, in a wording we invent.
    let result: string;
    switch (output.action) {
        case "getOrderStatus":
            result = getOrderStatus(output.orderNumber ?? "");
            break;
        case "checkStockLevel":
            result = checkStockLevel(output.partNumber ?? "");
            break;
    }
    messages.push({
        role: "user",
        content: `Result of ${output.action}: ${result}`,
    });
}