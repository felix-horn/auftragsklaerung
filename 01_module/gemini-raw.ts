import "dotenv/config";
import { costFromGemini } from "./cost.js";

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
  {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        { parts: [{ text: "In one sentence, what is idempotency?" }] },
      ],
    }),
  }
);

const data = await response.json();
console.log(JSON.stringify(data, null, 2));

console.log(costFromGemini(data))