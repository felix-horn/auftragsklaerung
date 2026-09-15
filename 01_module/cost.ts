const USD_TO_EUR = 0.861; // update periodically — this drifts

const PRICING_PER_MILLION = {
  anthropicSonnet5: { input: 2.00, output: 10.00 },
  geminiFlash35: { input: 1.50, output: 9.00 },
  // openai gpt-5.6 slot: $4.00 / $20.00 — wire this up once your key exists,
  // and check empirically whether reasoning_tokens is additive or already
  // included before trusting a number. Don't assume either way.
};

export function costFromAnthropic(data: any) {
  const inputTokens =
    data.usage.input_tokens +
    (data.usage.cache_creation_input_tokens ?? 0) +
    (data.usage.cache_read_input_tokens ?? 0); // both additive, per Anthropic's docs
  const outputTokens = data.usage.output_tokens; // thinking already included, do not add again
  const costUSD =
    (inputTokens / 1_000_000) * PRICING_PER_MILLION.anthropicSonnet5.input +
    (outputTokens / 1_000_000) * PRICING_PER_MILLION.anthropicSonnet5.output;
  return { provider: "anthropic", inputTokens, billedOutputTokens: outputTokens, costUSD, costEUR: costUSD * USD_TO_EUR };
}

export function costFromGemini(data: any) {
  const u = data.usageMetadata;
  const inputTokens = u.promptTokenCount;
  const outputTokens = u.candidatesTokenCount + (u.thoughtsTokenCount ?? 0); // additive, unlike Anthropic
  const costUSD =
    (inputTokens / 1_000_000) * PRICING_PER_MILLION.geminiFlash35.input +
    (outputTokens / 1_000_000) * PRICING_PER_MILLION.geminiFlash35.output;
  return { provider: "gemini", inputTokens, billedOutputTokens: outputTokens, costUSD, costEUR: costUSD * USD_TO_EUR };
}