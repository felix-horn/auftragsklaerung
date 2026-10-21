// Rules of the ERP stage (POLICY.md R-14 to R-16; CLAUDE.md, ERP stage).
// They belong to our code, not to the ERP: the ERP compares addresses
// exactly, never adds "A-" and returns any order to any caller (CLAUDE.md,
// Mock ERP).

// R-14: upper and lower case in the sender address don't matter. The ERP
// stores contact addresses in lower case and compares them exactly
// (src/erp-contract.ts), so the address is looked up in lower case.
// Expects the bare address ("m.weber@alpha.example"), not a header with a
// display name ("Max Weber <m.weber@alpha.example>").
export function senderAddressForLookup(senderAddress: string): string {
  return senderAddress.toLowerCase();
}

// R-15: five digits, with or without a prefix in front. The prefix is "A" or
// "a", with or without the hyphen: "A-10001", "a-10001", "A10001",
// "a10001", "10001". Nothing else, not even a space.
const LOOKUP_FORM = /^([Aa]-?)?\d{5}$/;

// R-15: the number to look up for one recorded order number, or null if it
// is not a valid order number (R-16: „Keine gültige Auftragsnummer.“).
// Every number in LOOKUP_FORM is looked up as "A-" plus its five digits.
// Limit: five digits without prefix are looked up even when the extraction
// should not have recorded them (R-09, Stufe 3 instead of Stufe 2). Telling
// the two apart needs the words around the number, which only the model
// sees.
export function orderNumberForLookup(recorded: string): string | null {
  if (!LOOKUP_FORM.test(recorded)) return null;
  return `A-${recorded.slice(-5)}`;
}
