// Module 4.1, part 4: toolChoice decides whether a tool must, may or must
// not be called. One request, the question from part 1, both tools, no
// `execute` (nothing runs; we only look at what the model asks for).
//   npx tsx 04_module/part4-tool-choice.ts auto              the model decides (default)
//   npx tsx 04_module/part4-tool-choice.ts required          some tool must be called
//   npx tsx 04_module/part4-tool-choice.ts none              no tool may be called
//   npx tsx 04_module/part4-tool-choice.ts checkStockLevel   this tool must be called
// One request per run.
import "dotenv/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";
import { loggingFetch } from "./logging-fetch.js";

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
};

const choices = {
    auto: "auto",
    required: "required",
    none: "none",
    checkStockLevel: { type: "tool", toolName: "checkStockLevel" },
} as const;

const setting = process.argv[2] as keyof typeof choices;
if (!(setting in choices)) {
    console.error(
        `Usage: npx tsx 04_module/part4-tool-choice.ts <${Object.keys(choices).join("|")}>`,
    );
    process.exit(1);
}

const anthropic = createAnthropic({ fetch: loggingFetch });

const result = await generateText({
    model: anthropic("claude-sonnet-5"),
    tools,
    toolChoice: choices[setting],
    messages: [{ role: "user", content: "Where is my order 44821?" }],
    maxOutputTokens: 500,
});

console.log(`--- verdict for toolChoice ${setting} ---`);
console.log("finishReason:", result.finishReason);
console.log("text:", JSON.stringify(result.text));
console.log(
    "tool calls:",
    result.toolCalls.map(({ toolName, input }) => ({ toolName, input })),
);