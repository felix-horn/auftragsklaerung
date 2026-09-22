// Validates the golden set and reports labelling progress.
// Run: npm run golden:check
try {
  const { goldenCases } = await import("./cases.js");
  const labelled = goldenCases.filter((c) => c.labels !== null).length;
  console.log(`Golden set valid. Labelled: ${labelled}/${goldenCases.length}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
