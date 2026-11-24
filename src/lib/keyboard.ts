// Page-wide keyboard shortcuts (practice's A–D and arrows, "/" for search, R for the reference
// panel) must leave alone keys meant for a text box or for an open modal dialog such as search.

/** The parts of an element the check reads. Any DOM element fits. */
export interface KeyTarget {
  tagName: string;
  type?: string;
  open?: boolean;
  isContentEditable?: boolean;
  parentElement: KeyTarget | null;
  /** Only dialogs need it: a dialog opened with show() (the docked reference panel) isn't ":modal". */
  matches?(selector: string): boolean;
}

/** Inputs that take no typing: keys on them (Enter on a picked choice, say) can still be shortcuts. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'range', 'color', 'file']);

/** The key went to something that takes typing, or to anything inside an open modal dialog. */
export function isTypingTarget(el: KeyTarget | null): boolean {
  if (!el) return false;
  for (let n: KeyTarget | null = el; n; n = n.parentElement) {
    if (n.tagName === 'DIALOG' && n.open && (n.matches?.(':modal') ?? true)) return true;
  }
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type ?? 'text');
}
