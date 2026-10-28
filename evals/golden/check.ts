// Validates the golden set and reports labelling progress.
// Run: npm run golden:check
try {
  const { goldenCases } = await import("./cases.js");
  const labelled = goldenCases.filter(
    (goldenCase) => goldenCase.labels !== null,
  ).length;
  console.log(`Golden set valid. Labelled: ${labelled}/${goldenCases.length}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
