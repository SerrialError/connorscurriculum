// What the periodic table does in the browser: search, naming the element pointed at or
// selected, and arrow keys. Started by ReferencePanel's script: on the reference page's table, and
// on the panel's copy once it's loaded.
import { searchElements } from './elements';

export function initPeriodicTable(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = '';

  const cells = [...root.querySelectorAll<HTMLButtonElement>('.pt-cell')];
  const grid = root.querySelector<HTMLElement>('.pt-grid')!;
  const input = root.querySelector<HTMLInputElement>('[data-pt-input]')!;
  const info = root.querySelector<HTMLElement>('[data-pt-info]')!;
  const elements = cells.map((c) => ({ number: Number(c.dataset.number), symbol: c.dataset.symbol!, name: c.dataset.name!, cell: c }));
  const at = new Map(cells.map((c) => [`${c.dataset.row}/${c.dataset.col}`, c]));
  // Group 3's "57–71" and "89–103" spaces lead to the first lanthanoid and actinoid.
  const first = (n: number) => cells.find((c) => c.dataset.number === String(n));
  if (first(57)) at.set('6/3', first(57)!);
  if (first(89)) at.set('7/3', first(89)!);
  const selected = () => cells.find((c) => c.getAttribute('aria-current') === 'true');
  // The hint from the page: one wording for each table size, picked by CSS.
  const hint = [...info.childNodes];

  /** "Iron (Fe) · 26 · 55.85 g/mol" in the line above the table, or the hint. */
  const describe = (c: HTMLButtonElement | undefined) => {
    if (!c) {
      info.replaceChildren(...hint);
      return;
    }
    const { number, symbol, name, mass } = c.dataset;
    const strong = document.createElement('strong');
    strong.textContent = `${name} (${symbol})`;
    // The rest in its own span, after the bold name.
    const rest = document.createElement('span');
    rest.textContent = ` · atomic number ${number} · ${mass ? `${mass} g/mol` : 'no mass listed'}`;
    info.replaceChildren(strong, rest);
  };

  /** Make one cell the selected one: highlighted, described, and the table's tab stop. */
  const select = (c: HTMLButtonElement, focus: boolean) => {
    for (const other of cells) {
      other.tabIndex = -1;
      other.removeAttribute('aria-current');
    }
    c.tabIndex = 0;
    c.setAttribute('aria-current', 'true');
    describe(c);
    if (focus) c.focus();
  };

  root.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.pt-cell');
    if (c) select(c, false);
  });
  // Pointing at an element names it; moving off the table goes back to the selected one.
  grid.addEventListener('pointerover', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.pt-cell');
    if (c && e.pointerType === 'mouse') describe(c);
  });
  grid.addEventListener('pointerleave', () => describe(selected()));

  // Arrow keys move to the nearest element in that direction, skipping empty spaces.
  root.addEventListener('keydown', (e) => {
    const c = (e.target as HTMLElement).closest<HTMLButtonElement>('.pt-cell');
    const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!c || !step) return;
    e.preventDefault();
    let row = Number(c.dataset.row);
    let col = Number(c.dataset.col);
    for (let i = 0; i < 18; i++) {
      row += step[0]!;
      col += step[1]!;
      if (row < 1 || row > 10 || col < 1 || col > 18) return;
      const next = at.get(`${row}/${col}`);
      if (next) return select(next, true);
    }
  });

  input.addEventListener('input', () => {
    const found = searchElements(elements, input.value);
    const hits = new Set(found.map((f) => f.cell));
    root.classList.toggle('searching', input.value.trim() !== '');
    for (const c of cells) c.classList.toggle('match', hits.has(c));
    if (found[0]) select(found[0].cell, false);
    else if (input.value.trim()) info.textContent = 'No element matches that.';
    else describe(selected());
  });
  // Enter jumps into the table at the best match.
  input.addEventListener('keydown', (e) => {
    const c = selected();
    if (e.key === 'Enter' && c) {
      e.preventDefault();
      c.focus();
    }
  });
}
