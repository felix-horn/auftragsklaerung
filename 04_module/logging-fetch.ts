// Helper for Module 4.1: see exactly what goes to Anthropic and what comes
// back.

// Wraps fetch: prints every request body before sending it, and every
// response body when it arrives.
// Pass it to createAnthropic({ fetch }), as src/extract.ts does for its dump.
export const loggingFetch: typeof fetch = async (input, options) => {
  console.log("--- request body sent to Anthropic ---");
  console.log(JSON.stringify(JSON.parse(String(options?.body)), null, 2));
  const response = await fetch(input, options);
  // clone(): a response body can be read only once, and the SDK still
  // needs to read it.
  console.log("--- response body from Anthropic ---");
  console.log(JSON.stringify(await response.clone().json(), null, 2));
  return response;
};