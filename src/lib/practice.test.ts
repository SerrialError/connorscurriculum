import { describe, expect, it } from 'vitest';
import {
  type FrqQuestion,
  type McqQuestion,
  type PracticeQuestion,
  type PracticeTest,
  emptyFilters,
  filterTopics,
  filterQuestions,
  filtersToQuery,
  frqEarned,
  frqTotal,
  isCorrect,
  parseFilters,
  recordResult,
  seededRng,
  selectQuestions,
  summarize,
  topicAccuracy,
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
    expect(f.n).toBe(10);
  });

  it('gives an empty query for default filters', () => {
    expect(filtersToQuery(emptyFilters())).toBe('');
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

  it('filters by difficulty and type', () => {
    expect(ids(filterQuestions(questions, { ...emptyFilters(), difficulty: [2, 3] }, tests))).toEqual(['q2', 'f1']);
    expect(ids(filterQuestions(questions, { ...emptyFilters(), type: 'frq' }, tests))).toEqual(['f1']);
  });
});

describe('selection', () => {
  it('returns all matching questions in order for mode "all"', () => {
    expect(selectQuestions(questions, { mode: 'all', n: 1 }, {})).toBe(questions);
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
