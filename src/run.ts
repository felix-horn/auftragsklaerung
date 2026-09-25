import 'dotenv/config';
import { extractEmail } from './extract.js';
import { deriveUrgency } from './urgency.js';
import { goldenCases } from './golden/cases.js';

let failures = 0;

for (const { id, email } of goldenCases) {
  try {
    const result = await extractEmail(email);
    console.log('Derived urgency:', deriveUrgency(result));
  } catch {
    failures++;
    console.error(`${id} failed extraction — see error above.`);
  }
  console.log('---');
}

console.log(`Completed: ${goldenCases.length - failures}/${goldenCases.length} extractions succeeded.`);
