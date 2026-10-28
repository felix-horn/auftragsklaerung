// Module 4.1, experiment: the extraction written after a lookup, in one
// generateText call with the SDK's loop (part 2's shape plus structured output).
// Same email (E-06), instructions and tool as the first run of
// experiment-extraction-plus-tool.ts, which ended with a tool call and no
// extraction. Difference: the tool has `execute` and stopWhen allows more than
// one request, so the SDK runs the lookup and asks again.
// Two questions:
//   1. Does the SDK parse the extraction from the last request's answer, the
//      one without a tool call?
//   2. Does the lookup result leak into the extraction? The ERP record names
//      customer K-40928; the email names no customer number, so the label is []
//      (R-01: only what the message says).
// src/extract.ts and src/schema.ts stay unchanged; this only imports them.
//   npx tsx 04_module/experiment-extraction-after-lookup.ts   up to three requests
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, isStepCount, Output, tool } from "ai";
import { z } from "zod";
import { DEFAULT_SYSTEM } from "../src/extract.js";
import { emailExtractionSchema } from "../src/schema.js";
import { goldenCases } from "../evals/golden/cases.js";
import { loggingFetch } from "./logging-fetch.js";

const e06 = goldenCases.find((goldenCase) => goldenCase.id === "E-06")!;

const anthropic = createAnthropic({ fetch: loggingFetch });

const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    instructions: DEFAULT_SYSTEM,
    output: Output.object({ schema: emailExtractionSchema }),
    tools: {
        getOrderStatus: tool({
            description:
                "Look up the current shipping/processing status of a customer order by its order number.",
            inputSchema: z.object({
                orderNumber: z.string().describe("The order number, e.g. 'A-12345'."),
            }),
            // An invented ERP record: the order belongs to customer K-40928.
            execute: async ({ orderNumber }) => ({
                orderNumber,
                customerNumber: "K-40928",
                status: "in Bearbeitung, noch nicht versandt",
            }),
        }),
    },
    messages: [{ role: "user", content: `Email:\n${e06.email}` }],
    maxOutputTokens: 2000,
    stopWhen: isStepCount(3),
});

console.log("--- verdict ---");
result.steps.forEach((step, index) => {
    console.log(
        `request ${index + 1}: finishReason ${step.finishReason}, tool calls: ${step.toolCalls.length}, text: ${step.text.length} characters`,
    );
});
// `output` is parsed from the last request's answer only, and only if that
// answer ended without a tool call. Otherwise reading it throws.
try {
    console.log("customerNumbers:", result.output.customerNumbers, "(label: [])");
    console.log("requestedAction:", result.output.requestedAction);
} catch (error) {
    console.log("extraction: none —", (error as Error).name);
}