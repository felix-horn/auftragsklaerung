import 'dotenv/config';
import { extractEmail } from './extract.js';

await extractEmail(
  `Guten Tag, zu Bestellung 61150 hätte ich eine Rückfrage zum Liefertermin. Kundennummer K-40928. MfG, R. Hoffmann`,
);
