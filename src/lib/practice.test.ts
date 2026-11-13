import { describe, expect, it } from 'vitest';
import {
  type FrqQuestion,
  type McqQuestion,
  type PracticeQuestion,
  type PracticeTest,
  activeFilterCount,
  countWith,
  emptyFilters,
  filterTopics,
  filterQuestions,
  filtersToQuery,
  frqEarned,
  frqTotal,
  isCorrect,
  parseFilters,
  recordResult,
  amendLastResult,
  seededRng,
  selectQuestions,
  sessionSize,
  summarize,
  topicAccuracy,
  topicBreakdown,
  wantsStart,
  CLASS_ONLY_UNIT,
  HISTORY_LIMIT,
} from './practice';

const mcq = (id: string, over: Partial<McqQuestion> = {}): McqQuestion => ({
  id,
  type: 'mcq',
  chapter: 14,
  sections: [],
  cedTopics: ['5.1'],
  units: ['5'],
  difficulty: 1,
  promptHtml: '',
  promptText: '',
  explanationHtml: '',
  choices: [
    { id: 'a', html: 'A' },
    { id: 'b', html: 'B' },
  ],
  answer: 'b',
  ...over,
});

const frq: FrqQuestion = {
  id: 'f1',
  type: 'frq',
  chapter: 15,
  sections: ['15.2'],
  cedTopics: ['7.3'],
  units: ['7'],
  difficulty: 3,
  promptHtml: '',
  promptText: '',
  explanationHtml: '',
  parts: [
    { label: 'a', promptHtml: '', points: 2, scoringHtml: ['x', 'y'] },
    { label: 'b', promptHtml: '', points: 1, scoringHtml: ['z'] },
  ],
};

const questions: PracticeQuestion[] = [
  mcq('q1'),
  mcq('q2', { cedTopics: ['5.2'], difficulty: 2 }),
  mcq('q3', { chapter: 13, cedTopics: [], units: [] }),
  frq,
];

const tests: PracticeTest[] = [
  { id: 'ch14', title: 'Ch 14', chapters: [14], sections: [] },
  { id: 'ch15-part', title: 'Ch 15 part', chapters: [15], sections: ['15.1'] },
];

describe('URL filters', () => {
  it('round-trips through the query string', () => {
    const f = { ...emptyFilters(), chapters: [14, 15], test: 'ch14', topics: ['5.1', '5.2'], units: ['7'], difficulty: [1, 3], type: 'mcq' as const, mode: 'random' as const, n: 5 };
    const q = filtersToQuery(f);
    expect(q).toBe('?chapter=14,15&test=ch14&unit=7&topic=5.1,5.2&difficulty=1,3&type=mcq&mode=random&n=5');
    expect(parseFilters(q)).toEqual(f);
  });

  it('ignores junk values', () => {
    const f = parseFilters('?chapter=abc,14&difficulty=0,2,9&type=essay&mode=nope&n=-3');
    expect(f.chapters).toEqual([14]);
    expect(f.difficulty).toEqual([2]);
    expect(f.type).toBeNull();
    expect(f.mode).toBe('all');
    expect(f.n).toBeNull();
  });

  it('defaults the count to all questions in order, or 10 when shuffled or weakest-first', () => {
    expect(parseFilters('').n).toBeNull();
    expect(parseFilters('?mode=random').n).toBe(10);
    expect(parseFilters('?mode=weak&n=-1').n).toBe(10);
    expect(parseFilters('?mode=random&n=all').n).toBeNull();
    expect(parseFilters('?n=5').n).toBe(5);
    expect(parseFilters('?n=9999').n).toBe(200);
  });

  it('writes n only when it differs from the default for the mode', () => {
    expect(filtersToQuery({ ...emptyFilters(), mode: 'random', n: 10 })).toBe('?mode=random');
    expect(filtersToQuery({ ...emptyFilters(), mode: 'random', n: null })).toBe('?mode=random&n=all');
    expect(filtersToQuery({ ...emptyFilters(), n: 5 })).toBe('?n=5');
    for (const f of [
      { ...emptyFilters(), mode: 'random' as const, n: null },
      { ...emptyFilters(), mode: 'weak' as const, n: 25 },
      { ...emptyFilters(), n: 3 },
    ]) {
      expect(parseFilters(filtersToQuery(f))).toEqual(f);
    }
  });

  it('keeps old links (?mode=random&n=10) working', () => {
    const f = parseFilters('?test=ch6-7-test&mode=random&n=10');
    expect(f).toMatchObject({ test: 'ch6-7-test', mode: 'random', n: 10 });
  });

  it('gives an empty query for default filters', () => {
    expect(filtersToQuery(emptyFilters())).toBe('');
  });
});

describe('wantsStart', () => {
  it('starts only when start is set to something truthy', () => {
    expect(wantsStart('?test=x&start=1')).toBe(true);
    expect(wantsStart('?start')).toBe(true);
    expect(wantsStart('?test=x')).toBe(false);
    expect(wantsStart('?start=0')).toBe(false);
  });

  it('is not a filter: it never ends up in the filter query', () => {
    expect(filtersToQuery(parseFilters('?test=x&mode=random&start=1'))).toBe('?test=x&mode=random');
  });
});

describe('filterQuestions', () => {
  const ids = (qs: PracticeQuestion[]) => qs.map((q) => q.id);

  it('filters by chapter', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), chapters: [14] }, tests))).toEqual(['q1', 'q2']);
  });

  it('filters by test chapters and sections', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch14' }, tests))).toEqual(['q1', 'q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'ch15-part' }, tests))).toEqual([]);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), test: 'missing' }, tests))).toEqual([]);
  });

  it('treats units and topics as one OR group', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'] }, tests))).toEqual(['q2']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), topics: ['5.2'], units: ['7'] }, tests))).toEqual(['q2', 'f1']);
  });

  it('selects class-only questions (no CED topic) with the class-only unit', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT] }, tests))).toEqual(['q3']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), units: [CLASS_ONLY_UNIT, '7'] }, tests))).toEqual(['q3', 'f1']);
    // With the class-only entry, unit counts add up to the total.
    const total = ['5', '7', CLASS_ONLY_UNIT].reduce((n, u) => n + countWith(questions, emptyFilters(), tests, { units: [u] }), 0);
    expect(total).toBe(questions.length);
    expect(parseFilters('?unit=class').units).toEqual([CLASS_ONLY_UNIT]);
  });

  it('counts matches for a changed filter without changing the others', () => {
    const f = { ...emptyFilters(), difficulty: [1] };
    expect(countWith(questions, f, tests, { chapters: [14] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [13] })).toBe(1);
    expect(countWith(questions, f, tests, { chapters: [15] })).toBe(0);
    expect(f.chapters).toEqual([]);
  });

  it('counts active filters, leaving out order and count', () => {
    expect(activeFilterCount({ ...emptyFilters(), mode: 'random', n: 5 })).toBe(0);
    expect(activeFilterCount({ ...emptyFilters(), chapters: [6, 7], test: 'x', type: 'mcq' })).toBe(4);
  });

  it('filters by difficulty and type', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), difficulty: [2, 3] }, tests))).toEqual(['q2', 'f1']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), type: 'frq' }, tests))).toEqual(['f1']);
  });
});

describe('selection', () => {
  it('returns matching questions in order for mode "all", up to n', () => {
    expect(selectQuestions(questions, { mode: 'all', n: null }, {})).toEqual(questions);
    expect(selectQuestions(questions, { mode: 'all', n: 2 }, {}).map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('shuffles every matching question when n is null', () => {
    expect(selectQuestions(questions, { mode: 'random', n: null }, {}, seededRng(3))).toHaveLength(questions.length);
  });

  it('reports the session size', () => {
    expect(sessionSize(40, { n: null })).toBe(40);
    expect(sessionSize(40, { n: 10 })).toBe(10);
    expect(sessionSize(4, { n: 10 })).toBe(4);
  });

  it('returns N random questions for mode "random"', () => {
    const picked = selectQuestions(questions, { mode: 'random', n: 2 }, {}, seededRng(1));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((q) => q.id)).size).toBe(2);
  });

  it('prefers the weakest topics for mode "weak"', () => {
    let h = {};
    h = recordResult(h, 'q1', 1);
    h = recordResult(h, 'q2', 0);
    h = recordResult(h, 'f1', 0.4);
    const acc = topicAccuracy(questions, h);
    expect(acc.get('5.1')).toBe(1);
    expect(acc.get('5.2')).toBe(0);
    expect(acc.get('chapter-13')).toBeUndefined();
    // 5.2 (0) < 7.3 (0.4) < unseen chapter-13 (0.5) < 5.1 (1)
    const picked = selectQuestions(questions, { mode: 'weak', n: 4 }, h, seededRng(7));
    expect(picked.map((q) => q.id)).toEqual(['q2', 'f1', 'q3', 'q1']);
  });

  it('keeps only recent results', () => {
    let h = {};
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = recordResult(h, 'q1', i % 2);
    expect((h as Record<string, number[]>).q1).toHaveLength(HISTORY_LIMIT);
  });
});

describe('grading', () => {
  it('grades MCQ', () => {
    expect(isCorrect(mcq('x'), 'b')).toBe(true);
    expect(isCorrect(mcq('x'), 'a')).toBe(false);
  });

  it('totals FRQ self-marks', () => {
    expect(frqTotal(frq)).toBe(3);
    expect(frqEarned(frq, [[true, false], [true]])).toBe(2);
    expect(frqEarned(frq, [])).toBe(0);
  });

  it('summarizes a session', () => {
    expect(
      summarize([
        { type: 'mcq', correct: true },
        { type: 'mcq', correct: false },
        { type: 'frq', earned: 2, possible: 3 },
      ]),
    ).toEqual({ mcqCorrect: 1, mcqAnswered: 2, frqEarned: 2, frqPossible: 3, frqDone: 1 });
  });
});

describe('filterTopics', () => {
  const units = [{ id: '5', topics: [{ id: '5.1' }, { id: '5.2' }] }];
  const chapterTopics = { '14': ['5.1', '5.2', '3.13'], '15': ['7.1'] };

  it('is empty without topic, unit, chapter, or test filters', () => {
    expect(filterTopics({ ...emptyFilters(), difficulty: [1] }, units, chapterTopics, tests).size).toBe(0);
  });

  it('combines topics, units, chapters, and the test', () => {
    const f = { ...emptyFilters(), topics: ['9.1'], units: ['5'], chapters: [15], test: 'ch14' };
    expect([...filterTopics(f, units, chapterTopics, tests)].sort()).toEqual(['3.13', '5.1', '5.2', '7.1', '9.1']);
  });
});

describe('topicBreakdown', () => {
  it('scores each topic in a session, weakest first, skipping unanswered questions', () => {
    const b = topicBreakdown(questions, { q1: 1, q2: 0, f1: 0.5 });
    expect(b).toEqual([
      { key: '5.2', score: 0, count: 1 },
      { key: '7.3', score: 0.5, count: 1 },
      { key: '5.1', score: 1, count: 1 },
    ]);
    expect(topicBreakdown(questions, { q3: 0 })).toEqual([{ key: 'chapter-13', score: 0, count: 1 }]);
  });
});

describe('amendLastResult', () => {
  it('replaces the latest score instead of adding one', () => {
    expect(amendLastResult({ q: [1, 0.5] }, 'q', 1)).toEqual({ q: [1, 1] });
  });
  it('records a score when there is none yet', () => {
    expect(amendLastResult({}, 'q', 0.25)).toEqual({ q: [0.25] });
  });
});
