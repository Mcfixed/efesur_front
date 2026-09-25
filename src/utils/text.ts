/** Utilidades de búsqueda de texto (compartidas por las features del panel). */

/**
 * Normaliza texto para búsquedas: ignora mayúsculas, tildes y espacios sobrantes.
 * Ej.: "tunel" encuentra "12Tunel Chepe"; "ESTACION" encuentra "SubEstación".
 */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Divide un término de búsqueda en palabras normalizadas. */
export function splitSearchTerms(value: unknown): string[] {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

/**
 * true si TODAS las palabras del término aparecen en alguno de los campos.
 * Un término vacío coincide con todo.
 */
export function matchesSearch(term: unknown, ...fields: unknown[]): boolean {
  const terms = splitSearchTerms(term);
  if (terms.length === 0) return true;
  const haystack = normalizeText(fields.join(' '));
  return terms.every(t => haystack.includes(t));
}
