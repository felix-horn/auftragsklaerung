import { z } from "zod";

// The settings our code reads from environment variables: today only the
// ERP's base URL. Locally they come from .env (loaded by `import
// "dotenv/config"` at the top of an entry point); see .env.example.
// ANTHROPIC_API_KEY is not here: the AI SDK reads it itself.
//
// Read once, at the start of an entry point (loadConfig). Pipeline code
// never reads environment variables or imports this file: it gets what it
// needs passed in, such as the ERP client built from erpBaseUrl. Unit tests
// therefore need no .env.

export type Config = {
  // Where the ERP answers, without a trailing slash: the mock ERP
  // (http://127.0.0.1:4100) or a real one. Paths such as /orders/… are
  // appended to it.
  erpBaseUrl: string;
};

const environmentSchema = z.object({
  ERP_BASE_URL: z
    .url({
      protocol: /^https?$/,
      error: (issue) =>
        issue.input === undefined
          ? "is not set (add it to .env, see .env.example)"
          : "must be an http or https URL, e.g. http://127.0.0.1:4100",
    })
    // "http://127.0.0.1:4100/" would turn /orders/A-10001 into
    // //orders/A-10001, a path the ERP doesn't have.
    .transform((url) => url.replace(/\/+$/, "")),
});

export type ConfigResult =
  | { kind: "valid"; config: Config }
  | { kind: "invalid"; problems: string };

/**
 * Checks the environment variables our code needs and turns them into a
 * Config. Prints nothing: an invalid environment comes back as text, one
 * line per problem, naming the variable.
 */
export function parseConfig(
  environment: Record<string, string | undefined>,
): ConfigResult {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    return { kind: "invalid", problems: z.prettifyError(result.error) };
  }
  return { kind: "valid", config: { erpBaseUrl: result.data.ERP_BASE_URL } };
}

/**
 * For entry points, before anything else runs: the Config from
 * process.env, or a message on stderr and exit code 1. Stopping at the
 * start beats failing at the first ERP lookup, halfway through a run.
 */
export function loadConfig(): Config {
  const result = parseConfig(process.env);
  if (result.kind === "invalid") {
    console.error("Not started: the environment is incomplete.");
    console.error(result.problems);
    process.exit(1);
  }
  return result.config;
}
