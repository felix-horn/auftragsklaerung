import type { EmailExtraction } from './schema.js';

export type Urgency = 'low' | 'medium' | 'high';

export function deriveUrgency(extraction: EmailExtraction): Urgency {
  const s = extraction.escalationSignals;
  if (s.includes('production_halt') || s.includes('legal_threat') || s.includes('threat_to_cancel')) {
    return 'high';
  }
  if (extraction.deadlineStated !== null || s.includes('repeat_contact')) {
    return 'medium';
  }
  return 'low';
}
