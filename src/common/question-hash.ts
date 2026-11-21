import { createHash } from 'node:crypto';

/**
 * Identity of a question, for duplicate detection.
 *
 * Strips what varies without changing what is being asked — case,
 * accents, punctuation, runs of whitespace — so two spellings of the
 * same question hash alike. Numbers survive: three apples and four
 * apples are different items however alike the wording.
 *
 * Lives here rather than in a service because both the write path and
 * the bank need it, and neither should depend on the other.
 */
export function normaliseQuestion(contexto: string, pregunta: string): string {
  return `${contexto} ${pregunta}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashQuestion(contexto: string, pregunta: string): string {
  return createHash('sha256').update(normaliseQuestion(contexto, pregunta)).digest('hex');
}
