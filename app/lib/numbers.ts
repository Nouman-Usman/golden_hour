// Whole, non-negative numbers from form fields or JSON: 7 and "7" ok; -1, 2.5, "", "abc" → null.
export function parseWholeNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? v : null;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}
