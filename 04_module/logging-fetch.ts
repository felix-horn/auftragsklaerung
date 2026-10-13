// Helper for Module 4.1: see exactly what the AI SDK sends to Anthropic.

// Wraps fetch: prints every request body before sending it.
// Pass it to createAnthropic({ fetch }), as src/extract.ts does for its dump.
export const loggingFetch: typeof fetch = async (input, init) => {
  console.log("--- request body sent to Anthropic ---");
  console.log(JSON.stringify(JSON.parse(String(init?.body)), null, 2));
  return fetch(input, init);
};


