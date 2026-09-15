import "dotenv/config";
import { costFromAnthropic } from "./cost.js";


const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-5",
    max_tokens: 200,
    messages: [
      { role: "user", content: "In one sentence, what is idempotency?" }
    ],
  }),
});

const data = await response.json();
console.log(JSON.stringify(data, null, 2));

console.log(costFromAnthropic(data))