// Module 4.1, experiment: the extraction and a chosen next action in one
// answer.
// One request with E-06: the extraction schema from src/schema.ts, extended
// here by one field, nextAction, plus a getOrderStatus tool. The tool is
// listed only as the menu for nextAction; the model is told not to call it.
// No loop. We look at what comes back: the extraction with nextAction filled
// in, a tool call instead, or both.
// src/extract.ts and src/schema.ts stay unchanged; this only imports them.
//   npx tsx 04_module/experiment-extraction-plus-tool.ts   one request
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output, tool } from "ai";
import { z } from "zod";
import { DEFAULT_SYSTEM } from "../src/extract.js";
import { emailExtractionSchema } from "../src/schema.js";
import { goldenCases } from "../evals/golden/cases.js";
import { loggingFetch } from "./logging-fetch.js";

const e06 = goldenCases.find((goldenCase) => goldenCase.id === "E-06")!;

// Today's seven fields plus nextAction, in this file only.
const extractionWithNextAction = emailExtractionSchema.extend({
    nextAction: z
        .object({
            action: z
                .string()
                .describe(
                    "The name of one tool listed in this request, or 'none' if no lookup is needed.",
                ),
            orderNumber: z
                .string()
                .nullable()
                .describe(
                    "For getOrderStatus: the order number to look up. Otherwise null.",
                ),
        })
        .describe(
            "The lookup our system should run next for this email. The tools in this request are included only so you can name one here: do not call them, write the name into this field.",
        ),
});

const anthropic = createAnthropic({ fetch: loggingFetch });

const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    instructions: DEFAULT_SYSTEM,
    output: Output.object({ schema: extractionWithNextAction }),
    tools: {
        // No execute: nothing runs. Listed as the menu for nextAction.
        getOrderStatus: tool({
            description:
                "Look up the current shipping/processing status of a customer order by its order number.",
            inputSchema: z.object({
                orderNumber: z.string().describe("The order number, e.g. 'A-12345'."),
            }),
        }),
    },
    messages: [{ role: "user", content: `Email:\n${e06.email}` }],
    maxOutputTokens: 2000,
});

console.log("--- verdict ---");
console.log("finishReason:", result.finishReason);
console.log("text:", JSON.stringify(result.text));
console.log(
    "tool calls:",
    result.toolCalls.map(({ toolName, input }) => ({ toolName, input })),
);
// `output` throws when the SDK parsed no extraction. It only parses the text
// of an answer that ends without a tool call (finishReason "stop").
try {
    console.log("extraction:", result.output);
} catch (error) {
    console.log("extraction: none —", (error as Error).name);
}