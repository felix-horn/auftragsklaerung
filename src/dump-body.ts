import 'dotenv/config';
import { extractEmail } from './extract.js';

// `npm run dump:reference`: one real API call,
// so that extract.ts can write the request body to the file DUMP_REQUEST_BODY_PATH names.
// Diff that file after changing the system prompt,
// schema.ts or a generateText parameter.
await extractEmail(
  `Guten Tag, zu Bestellung 61150 hätte ich eine Rückfrage zum Liefertermin. Kundennummer K-40928. MfG, R. Hoffmann`,
);
