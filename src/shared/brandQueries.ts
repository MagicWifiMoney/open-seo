/** Brand terms for the brand / non-brand split. A search query is a brand query
 *  when it contains any term (case-insensitive). The Miller dashboard serves a
 *  single client, so this is a config constant rather than a per-project field:
 *  the project record carries no brand name. */
export const BRAND_TERMS: readonly string[] = ["miller"];

function normalize(terms: readonly string[]): string[] {
  return terms.map((term) => term.trim().toLowerCase()).filter(Boolean);
}

export function isBrandQuery(
  query: string,
  terms: readonly string[] = BRAND_TERMS,
): boolean {
  const haystack = query.toLowerCase();
  return normalize(terms).some((term) => haystack.includes(term));
}

/** One mutually exclusive GSC filter set per term, so summing the per-term
 *  totals never counts a query twice: term N matches and terms before it do
 *  not. */
export function brandFilterSets(
  terms: readonly string[] = BRAND_TERMS,
): { operator: "contains" | "notContains"; expression: string }[][] {
  const clean = normalize(terms);
  return clean.map((term, index) => [
    ...clean.slice(0, index).map((earlier) => ({
      operator: "notContains" as const,
      expression: earlier,
    })),
    { operator: "contains" as const, expression: term },
  ]);
}
