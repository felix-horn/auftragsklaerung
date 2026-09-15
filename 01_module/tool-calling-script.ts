import "dotenv/config";

const apiKey = process.env.ANTHROPIC_API_KEY!;

// Local stand-in for your future mock ERP (Module 4). The model
// never runs this — it only ever asks you to.
function getOrderStatus(orderNumber: string): string {
  const fakeOrders: Record<string, string> = {
    "44821": "shipped, arriving 2026-09-05",
    "44822": "processing, not yet shipped",
  };
  return fakeOrders[orderNumber] ?? `no order found with number ${orderNumber}`;
}

const tools = [
  {
    name: "get_order_status",
    description:
      "Look up the current shipping/processing status of a customer order by its order number.",
    input_schema: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description: "The order number, e.g. '44821'.",
        },
      },
      required: ["order_number"],
    },
  },
];

// The flat messages array from Module 1 part 1 — every turn, including
// tool calls and their results, gets appended here before the next call.
let messages: any[] = [
  { role: "user", content: "Where is my order 44821?" },
];

async function callClaude() {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 500,
      tools,
      messages,
    }),
  });
  return response.json();
}

// --- Round 1 ---
let data = await callClaude();
console.log("Full response:", JSON.stringify(data, null, 2));
console.log("Round 1 stop_reason:", data.stop_reason);
console.log(JSON.stringify(data.content, null, 2));

if (data.stop_reason === "tool_use") {
  // Append the assistant's turn exactly as returned — it contains the tool_use block.
  messages.push({ role: "assistant", content: data.content });

  console.log("Appended messages: ", messages)
  
  const toolUseBlock = data.content.find((contentBlock: any) => contentBlock.type === "tool_use");
console.log("Content 'tool_use block': ", toolUseBlock)

  // You execute it. This is the step that is genuinely yours, not the model's.
  const result = getOrderStatus(toolUseBlock.input.order_number);

  // Result goes back in as a user message containing a tool_result block,
  // tied to the original call via tool_use_id.
  messages.push({
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: toolUseBlock.id, content: result },
    ],
  });

    console.log("Appended messages: ", messages)
  console.log("last message: ", messages[2])


  // --- Round 2 ---
  data = await callClaude();
  console.log("Round 2 stop_reason:", data.stop_reason);
  console.log(JSON.stringify(data.content, null, 2));
}