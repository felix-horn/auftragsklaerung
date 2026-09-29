import type { ApiProvider, ProviderResponse } from "promptfoo";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { extractEmail } from "../../src/extract.js";

// The pipeline under test: every email goes through extractEmail,
// with the system prompt, schema and settings from src/.
// `prompt` is the filled-in '{{email}}' template from the config, i.e. the email text.
export default class ExtractEmailProvider implements ApiProvider {
  id = () => "extractEmail";

  async callApi(prompt: string): Promise<ProviderResponse> {
    try {
      const { output, usage } = await extractEmail(prompt);
      return {
        output,
        tokenUsage: {
          prompt: usage.inputTokens,
          completion: usage.outputTokens, // includes the thinking tokens
          total: usage.totalTokens,
        },
      };
    } catch (error) {
      // The model answered, but not with a valid extraction. That is a
      // result of the pipeline, so it has to count as a failed case: the raw
      // answer becomes the output, and the schema assertion fails on it.
      if (NoObjectGeneratedError.isInstance(error)) {
        return { output: error.text ?? "" };
      }
      // The model finished without any answer to check (cut off, refused).
      if (NoOutputGeneratedError.isInstance(error)) {
        return { output: "" };
      }
      // Anything else (missing key, network, rate limit, server error) says
      // nothing about the pipeline: an ERROR row, not a failed case.
      return { error: String(error) };
    }
  }
}
