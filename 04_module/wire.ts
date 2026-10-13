// Helpers for Module 4.1: see exactly what the AI SDK sends to Anthropic,
// with the real API or without it.

// Wraps a fetch function: prints every request body before sending it.
// Pass it to createAnthropic({ fetch }), as src/extract.ts does for its dump.
export function loggingFetch(send: typeof fetch = fetch): typeof fetch {
  let count = 0;
  return async (input, init) => {
    count++;
    console.log(`--- request ${count}: body sent to Anthropic ---`);
    console.log(JSON.stringify(JSON.parse(String(init?.body)), null, 2));
    return send(input, init);
  };
}

// A stand-in for Anthropic's API: answers each request with the next of the
// prepared response bodies, without any network call. Costs nothing, and
// gives the same answer every time.
export function fakeAnthropic(responses: object[]): typeof fetch {
  let next = 0;
  return async () => {
    const body = responses[Math.min(next, responses.length - 1)];
    next++;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}