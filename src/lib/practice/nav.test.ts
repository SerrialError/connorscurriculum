import { describe, expect, it } from 'vitest';
import { type CurrentSet, type Entry, type Screen, type Step, land, readEntry, startSet, syncSetup, toResults, toReview, toSetup } from './nav';
import { setupQuery } from './url';

/**
 * A browser history and the practice page, cut down to what the steps touch: each entry is an
 * address (a practice query, or another page) and its state. Mirrors what Practice.svelte does:
 * apply an action's steps, and on landing (load, Back, Forward) show what `land` says.
 */
class Browser {
  entries: { url: string; state: Entry }[];
  at: number;
  /** What the practice page shows. */
  screen: Screen | 'elsewhere' = 'elsewhere';
  reviewing = false;
  set: CurrentSet | null = null;
  /** The sets that can be opened (the saved ones, or any address naming a seed). */
  private known = new Map<string, CurrentSet>();

  constructor(...urls: string[]) {
    this.entries = urls.map((url) => ({ url, state: null }));
    this.at = urls.length - 1;
    this.arrive();
  }
  get url() {
    return this.entries[this.at]!.url;
  }
  get entry() {
    return this.entries[this.at]!.state;
  }
  get length() {
    return this.entries.length;
  }

  apply(steps: Step[]) {
    for (const s of steps) {
      if (s.op === 'go') {
        this.at += s.delta;
        this.arrive();
      } else if (s.op === 'push') {
        this.entries.splice(this.at + 1, Infinity, { url: s.query, state: s.entry });
        this.at++;
      } else {
        this.entries[this.at] = { url: s.query, state: s.entry };
      }
    }
  }
  back() {
    this.apply([{ op: 'go', delta: -1 }]);
  }
  forward() {
    this.apply([{ op: 'go', delta: 1 }]);
  }
  reload() {
    this.arrive();
  }
  /** Open a link to the practice page from another page. */
  open(query: string) {
    this.entries.splice(this.at + 1, Infinity, { url: query, state: null });
    this.at++;
    this.arrive();
  }

  private arrive() {
    if (!this.url.startsWith('?') && this.url !== '') {
      this.screen = 'elsewhere';
      return;
    }
    const seed = new URLSearchParams(this.url).get('seed');
    const start = new URLSearchParams(this.url).has('start');
    let opened: CurrentSet | null = null;
    if (start) {
      // A link with no seed gets one; one with a seed reopens that set.
      const id = seed ?? 'new1';
      opened = { id, query: seed ? this.url : `${this.url}&seed=${id}` };
    } else if (this.entry) {
      opened = this.known.get(this.entry.set) ?? null;
    }
    const { entry, steps } = land(this.url, this.entry, opened);
    this.apply(steps);
    this.screen = entry?.phase ?? 'setup';
    this.reviewing = !!entry?.reviewing;
    this.set = opened;
    if (opened) this.known.set(opened.id, opened);
  }

  // The page's actions.
  start(filters: string, id: string) {
    const set = { query: `${filters}${filters ? '&' : '?'}start=1&seed=${id}`, id };
    this.apply(startSet(this.screen as Screen, this.entry, filters, set));
    this.known.set(id, set);
    this.set = set;
    this.screen = 'session';
    this.reviewing = false;
  }
  filters() {
    const steps = toSetup(this.entry, this.set!);
    this.apply(steps);
    if (!steps.some((s) => s.op === 'go')) this.screen = 'setup';
  }
  results() {
    const steps = toResults(this.entry, this.set!);
    this.apply(steps);
    if (!steps.some((s) => s.op === 'go')) this.screen = 'results';
  }
  review() {
    this.apply(toReview(this.entry, this.set!));
    this.screen = 'session';
    this.reviewing = true;
  }
  pick(filters: string) {
    this.apply(syncSetup(this.url, filters));
  }
}

describe('readEntry', () => {
  it('reads a set entry, and treats anything else as setup', () => {
    expect(readEntry({ phase: 'results', depth: 2, set: 'abc' })).toEqual({ phase: 'results', depth: 2, set: 'abc' });
    expect(readEntry({ phase: 'session', depth: 1, reviewing: true, set: 'abc' })).toEqual({ phase: 'session', depth: 1, reviewing: true, set: 'abc' });
    expect(readEntry({ phase: 'session', depth: -3, set: 'abc' })?.depth).toBe(0);
    expect(readEntry({ phase: 'session', set: 'abc' })?.depth).toBe(0);
    for (const junk of [null, undefined, 'x', {}, { phase: 'setup', set: 'a' }, { phase: 'session' }]) expect(readEntry(junk)).toBeNull();
  });
});

describe('practice history', () => {
  it('setup: picking filters updates the address without adding entries', () => {
    const b = new Browser('home', '');
    b.pick('?chapter=7');
    b.pick('?chapter=7&difficulty=3');
    expect(b.length).toBe(2);
    expect(b.url).toBe('?chapter=7&difficulty=3');
    expect(syncSetup('?chapter=7', '?chapter=7')).toEqual([]);
  });

  it('Start from setup: Back returns to the same filters, Forward to the set', () => {
    const b = new Browser('home', '?chapter=7&difficulty=3');
    b.start('?chapter=7&difficulty=3', 'abc');
    expect(b.screen).toBe('session');
    expect(b.entry).toEqual({ phase: 'session', depth: 1, set: 'abc' });
    b.back();
    expect([b.screen, b.url]).toEqual(['setup', '?chapter=7&difficulty=3']);
    b.forward();
    expect([b.screen, b.set?.id]).toEqual(['session', 'abc']);
    b.back();
    b.back();
    expect(b.screen).toBe('elsewhere');
  });

  it('a quick start writes its filters into the setup entry first', () => {
    const b = new Browser('');
    b.start('?test=ch6-7-test', 'abc');
    b.back();
    expect([b.screen, b.url]).toEqual(['setup', '?test=ch6-7-test']);
  });

  it('"← Filters" goes back to the setup entry, so Forward returns to the set', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.filters();
    expect([b.screen, b.url, b.at]).toEqual(['setup', '?chapter=7', 1]);
    b.forward();
    expect(b.screen).toBe('session');
  });

  it('a set opened from a link replaces the link: Back leaves, "← Filters" swaps in its filters', () => {
    const b = new Browser('home');
    b.open('?test=ch6-7-test&start=1');
    expect(b.screen).toBe('session');
    expect(b.url).toBe('?test=ch6-7-test&start=1&seed=new1');
    expect(b.entry).toEqual({ phase: 'session', depth: 0, set: 'new1' });
    expect(b.length).toBe(2);
    b.filters();
    expect([b.screen, b.url, b.length]).toEqual(['setup', '?test=ch6-7-test', 2]);
    b.back();
    expect(b.screen).toBe('elsewhere');
  });

  it('Back from a set opened from a link returns to the page the link was on', () => {
    const b = new Browser('home');
    b.open('?chapter=7&start=1&seed=shared');
    b.back();
    expect(b.screen).toBe('elsewhere');
    b.forward();
    expect([b.screen, b.set?.id]).toEqual(['session', 'shared']);
  });

  it('results replace the set entry: Back from results returns to the filters', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.results();
    expect(b.entry).toEqual({ phase: 'results', depth: 1, set: 'abc' });
    expect(b.length).toBe(3);
    b.back();
    expect(b.screen).toBe('setup');
    b.forward();
    expect(b.screen).toBe('results');
  });

  it('reload keeps the screen: the set, its results, or a reviewed question', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.reload();
    expect([b.screen, b.length]).toEqual(['session', 3]);
    b.results();
    b.reload();
    expect(b.screen).toBe('results');
    b.review();
    b.reload();
    expect([b.screen, b.reviewing]).toEqual(['session', true]);
  });

  it('reviewing from the results: Back and "Back to results" both return to the results', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.results();
    b.review();
    expect(b.entry).toEqual({ phase: 'session', depth: 2, reviewing: true, set: 'abc' });
    b.back();
    expect([b.screen, b.reviewing]).toEqual(['results', false]);
    b.review();
    b.results();
    expect([b.screen, b.length]).toEqual(['results', 4]);
    // Opening another question while reviewing adds nothing.
    b.review();
    expect(toReview(b.entry, b.set!)).toEqual([]);
  });

  it('"← Filters" while reviewing goes all the way back to the setup entry', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.results();
    b.review();
    b.filters();
    expect([b.screen, b.at]).toEqual(['setup', 1]);
  });

  it('a new set from the results: Back returns to the old results, "← Filters" to setup', () => {
    const b = new Browser('home', '?chapter=7');
    b.start('?chapter=7', 'abc');
    b.results();
    b.start('?chapter=7', 'def');
    expect(b.entry).toEqual({ phase: 'session', depth: 2, set: 'def' });
    b.back();
    expect([b.screen, b.set?.id]).toEqual(['results', 'abc']);
    b.forward();
    b.filters();
    expect([b.screen, b.url, b.at]).toEqual(['setup', '?chapter=7', 1]);
  });

  it('a retry from the results of a linked set has no setup entry below either', () => {
    const b = new Browser('home');
    b.open('?chapter=7&start=1&seed=abc');
    b.results();
    b.start('?chapter=7', 'def');
    expect(b.entry?.depth).toBe(0);
    b.filters();
    expect([b.screen, b.url]).toEqual(['setup', '?chapter=7']);
    b.back();
    expect([b.screen, b.set?.id]).toEqual(['results', 'abc']);
  });

  it('an entry whose set is gone shows setup with its filters', () => {
    const steps = land('?chapter=7&start=1&seed=gone', { phase: 'results', depth: 1, set: 'gone' }, null);
    expect(steps).toEqual({ entry: null, steps: [{ op: 'replace', query: '?chapter=7', entry: null }] });
    expect(land('?chapter=7', null, null)).toEqual({ entry: null, steps: [] });
  });

  it('names the set in an entry that pointed at another one', () => {
    const set = { query: '?start=1&seed=new', id: 'new' };
    const { entry, steps } = land(set.query, { phase: 'results', depth: 1, set: 'old' }, set);
    expect(entry).toEqual({ phase: 'results', depth: 1, set: 'new' });
    expect(steps).toEqual([{ op: 'replace', query: set.query, entry }]);
  });

  it('toSetup without a setup entry uses the filters of the set', () => {
    expect(toSetup(null, { query: '?difficulty=3&start=1&seed=a&ids=q1', id: 'a' })).toEqual([
      { op: 'replace', query: setupQuery('?difficulty=3'), entry: null },
    ]);
  });
});
