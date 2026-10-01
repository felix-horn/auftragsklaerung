import { z } from "zod";
import { emailExtractionSchema } from "../schema.js";

// Code values come from the extraction schema, so they cannot drift apart:
// rename a value there, and every label still using the old one fails to load.
const intentType = emailExtractionSchema.shape.intents.element.shape.type;
const escalationSignal = emailExtractionSchema.shape.escalationSignals.element;

const hasNoDuplicates = (items: string[]) =>
  new Set(items).size === items.length;

// One golden case's correct answers. Conventions: docs/LABELLING.md.
export const goldenLabelsSchema = z
  .strictObject({
    intents: z
      .array(intentType)
      .min(1, { error: "at least one Anliegen (R-04)" })
      .refine(hasNoDuplicates, { error: "duplicate code value" }),
    requestedAction: z.string().min(1).nullable(),
    orderNumbers: z
      .array(z.string().min(1))
      .refine(hasNoDuplicates, { error: "duplicate number" }),
    customerNumbers: z
      .array(z.string().min(1))
      .refine(hasNoDuplicates, { error: "duplicate number" }),
    escalationSignals: z
      .array(escalationSignal)
      .refine(hasNoDuplicates, { error: "duplicate code value" }),
    deadlineStated: z.string().min(1).nullable(),
    urgency: z.enum(["low", "medium", "high"]),
  })
  .refine(
    (labels) =>
      !(labels.intents.includes("spam") && labels.requestedAction !== null),
    {
      error: "Werbung has no gewünschte Maßnahme (R-07)",
      path: ["requestedAction"],
    },
  );

export const goldenCaseSchema = z
  .strictObject({
    id: z.string().regex(/^E-\d{2}$/),
    email: z.string().min(1),
    // null = not yet labelled. Labels and policyVersion are set together.
    policyVersion: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .nullable(),
    labels: goldenLabelsSchema.nullable(),
    notes: z
      .partialRecord(goldenLabelsSchema.keyof(), z.string().min(1))
      .optional(),
  })
  .refine((c) => (c.labels === null) === (c.policyVersion === null), {
    error: "labels and policyVersion are set together",
    path: ["policyVersion"],
  })
  // R-02: order/customer numbers and deadlines are recorded in the wording of the email,
  // so every such value has to occur in the email text.
  .superRefine((c, ctx) => {
    if (c.labels === null) return;
    const verbatim = [
      ["orderNumbers", c.labels.orderNumbers],
      ["customerNumbers", c.labels.customerNumbers],
      [
        "deadlineStated",
        c.labels.deadlineStated === null ? [] : [c.labels.deadlineStated],
      ],
    ] as const;

    for (const [field, values] of verbatim) {
      values.forEach((value, index) => {
        if (c.email.includes(value)) return;
        ctx.addIssue({
          code: "custom",
          message: `"${value}" does not occur in the email (R-02)`,
          path:
            field === "deadlineStated"
              ? ["labels", field]
              : ["labels", field, index],
        });
      });
    }
  });

export type GoldenCaseInput = z.input<typeof goldenCaseSchema>;
export type GoldenCase = z.output<typeof goldenCaseSchema>;
export type GoldenLabels = z.output<typeof goldenLabelsSchema>;

// Validates every case and reports problems by case id, not by array index.
export function validateGoldenSet(rawCases: GoldenCaseInput[]): GoldenCase[] {
  const problems: string[] = [];
  const cases: GoldenCase[] = [];

  for (const rawCase of rawCases) {
    const result = goldenCaseSchema.safeParse(rawCase);
    if (result.success) cases.push(result.data);
    else problems.push(`${rawCase.id}:\n${z.prettifyError(result.error)}`);
  }

  const ids = rawCases.map((c) => c.id);
  if (!hasNoDuplicates(ids)) problems.push("duplicate id");

  if (problems.length > 0) {
    throw new Error(`Golden set invalid:\n\n${problems.join("\n\n")}`);
  }
  return cases;
}
