// Questions and tests shared by the practice unit tests.
import type { FrqQuestion, McqQuestion, PracticeQuestion, PracticeTest } from './types';

export const mcq = (id: string, over: Partial<McqQuestion> = {}): McqQuestion => ({
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

export const frq: FrqQuestion = {
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

export const questions: PracticeQuestion[] = [
  mcq('q1'),
  mcq('q2', { cedTopics: ['5.2'], difficulty: 2 }),
  mcq('q3', { chapter: 13, cedTopics: [], units: [] }),
  frq,
];

export const tests: PracticeTest[] = [
  { id: 'ch14', title: 'Ch 14', chapters: [14], sections: [] },
  { id: 'ch15-part', title: 'Ch 15 part', chapters: [15], sections: ['15.1'] },
];
