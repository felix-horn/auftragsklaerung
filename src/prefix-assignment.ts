import type { EmailExtraction } from "./schema.js";

type Identifiers = Pick<EmailExtraction, "orderNumbers" | "customerNumbers">;

// R-09: "A-" or "K-" followed by five digits.
const ORDER_NUMBER = /^A-\d{5}$/;
const CUSTOMER_NUMBER = /^K-\d{5}$/;

/**
 * Corrects the extraction's assignment of numbers by their prefix (R-09,
 * Stufe 1): a number with one of our prefixes goes where the prefix says,
 * whatever the customer called it. "A-10001" goes to orderNumbers,
 * "K-20001" to customerNumbers. Every other number stays where the model
 * put it: Stufe 2 and 3 depend on the words around the number, which only
 * the model sees. Changes only which list a number is in; nothing is
 * added, removed or merged.
 *
 * TODO(Module 5): try inside extractEmail, as the experiment "Prefix
 * assignment" (CLAUDE.md, Open experiments).
 */
export function assignIdentifiersByPrefix(input: Identifiers): Identifiers {
  const orderNumbers: string[] = [];
  const customerNumbers: string[] = [];

  const place = (id: string, listTheModelChose: string[]) => {
    if (ORDER_NUMBER.test(id)) orderNumbers.push(id);
    else if (CUSTOMER_NUMBER.test(id)) customerNumbers.push(id);
    else listTheModelChose.push(id);
  };

  for (const id of input.orderNumbers) place(id, orderNumbers);
  for (const id of input.customerNumbers) place(id, customerNumbers);

  return { orderNumbers, customerNumbers };
}
