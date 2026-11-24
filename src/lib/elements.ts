// The periodic table's layout and element search. No math library here: the periodic table's
// browser script imports this, so it must stay small.

/**
 * Row and column (1-based) in the usual 18-column layout. Rows 1–7 are the periods; the
 * lanthanoids and actinoids sit apart in rows 9 and 10, under groups 4–17, with row 8 left as a gap.
 */
export function periodicPosition(n: number): { row: number; col: number } {
  if (!Number.isInteger(n) || n < 1 || n > 118) throw new Error(`no element ${n}`);
  if (n === 1) return { row: 1, col: 1 };
  if (n === 2) return { row: 1, col: 18 };
  if (n >= 57 && n <= 71) return { row: 9, col: n - 57 + 4 };
  if (n >= 89 && n <= 103) return { row: 10, col: n - 89 + 4 };
  // Periods 2–7: [first element, period length]. Periods 6 and 7 skip the f-block (14 elements).
  const periods: [number, number, number][] = [
    [3, 2, 8],
    [11, 3, 8],
    [19, 4, 18],
    [37, 5, 18],
    [55, 6, 32],
    [87, 7, 32],
  ];
  for (const [first, row, length] of periods) {
    if (n >= first + length) continue;
    let i = n - first; // 0-based index within the period
    if (length === 32) i = i < 2 ? i : i - 14; // after Cs/Ba (Fr/Ra) come Hf (Rf) onward in group 4
    if (length === 8) return { row, col: i < 2 ? i + 1 : i + 11 };
    return { row, col: i + 1 };
  }
  throw new Error(`no position for element ${n}`);
}

export interface ElementLike {
  number: number;
  symbol: string;
  name: string;
}

/**
 * Elements matching a search: an exact symbol or atomic number first, then names starting with
 * it, then names containing it. "c" finds carbon first, then chlorine and calcium.
 */
export function searchElements<T extends ElementLike>(elements: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (e: T): number => {
    if (e.symbol.toLowerCase() === q || String(e.number) === q) return 0;
    const name = e.name.toLowerCase();
    if (name.startsWith(q)) return 1;
    if (q.length >= 2 && e.symbol.toLowerCase().startsWith(q)) return 2;
    if (q.length >= 3 && name.includes(q)) return 3;
    return -1;
  };
  return elements
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.e.number - b.e.number)
    .map((x) => x.e);
}
