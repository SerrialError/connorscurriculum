// What the practice screens know about the class: built once by the practice page and shared
// with every practice component through context, so it isn't passed down prop by prop.
import { createContext } from 'svelte';
import type { FrqLink } from '../../lib/frqs';
import { ALL_QUESTIONS, areaLabel } from '../../lib/practice/labels';
import type { PracticeLesson } from '../../lib/practice/lessons';
import type { Preset } from '../../lib/practice/presets';
import type { ScoreArea } from '../../lib/practice/score';
import type { PracticeTest, QuestionMeta } from '../../lib/practice/types';
import { chapterRange } from '../../lib/text';

export interface PracticeChapter {
  number: number;
  title: string;
  hasQuestions: boolean;
  /** Being studied in class now. */
  current: boolean;
  finished: boolean;
}

export interface PracticeUnit {
  id: string;
  title: string;
  topics: { id: string; title: string }[];
}

/** The practice page's data, as the Astro page builds it. */
export interface PracticeCourse {
  subject: string;
  /** Every question without its text (lib/practice/build.ts questionMeta). */
  questions: QuestionMeta[];
  /** Where each chapter's question text is: append "<chapter>.json". */
  questionsBase: string;
  /** Chapters whose text loads in the background once the page is idle: the ones the class is on. */
  prefetchChapters: number[];
  chapters: PracticeChapter[];
  units: PracticeUnit[];
  tests: PracticeTest[];
  /** Released AP FRQs with per-part topic tags. */
  frqs: FrqLink[];
  /** chapter number -> CED topics it teaches */
  chapterTopics: Record<string, string[]>;
  /** Topics learned this year or last year, for FRQ readiness. */
  learnedTopics: string[];
  /** Science practice id ("5") -> name ("Mathematical Routines") */
  practiceNames: Record<string, string>;
  /** Ready-made sets shown above the filters (the latest class test, etc.). */
  presets: Preset[];
  /** Lessons to point to from explanations and results. */
  lessons: PracticeLesson[];
  /** Base URLs; a topic id or chapter number and "/" are appended to the first two. */
  hrefs: { topics: string; chapters: string; frqs: string };
}

/** The course plus what every screen derives from it. */
export interface Course extends PracticeCourse {
  topicTitles: ReadonlyMap<string, string>;
  learned: ReadonlySet<string>;
  /** Chapters with sample questions the class hasn't reached (only in a set when picked). */
  laterChapters: number[];
  /** The default pool's name: "Ch. 6–7" when later chapters are left out, else "All questions". */
  everything: string;
  /** "5.4 Elementary Reactions", or the chapter for class-only questions. */
  areaLabel: (area: ScoreArea) => string;
}

export function withDerived(c: PracticeCourse): Course {
  const topicTitles = new Map(c.units.flatMap((u) => u.topics.map((t) => [t.id, t.title] as const)));
  // With no chapter picked, practice draws from the chapters the class has reached; questions for
  // later chapters (samples) come in only when their chapter is picked.
  const taught = c.chapters.filter((ch) => ch.hasQuestions && (ch.finished || ch.current)).map((ch) => ch.number);
  const laterChapters = c.chapters.filter((ch) => ch.hasQuestions && !ch.finished && !ch.current).map((ch) => ch.number);
  return {
    ...c,
    topicTitles,
    learned: new Set(c.learnedTopics),
    laterChapters,
    everything: laterChapters.length && taught.length ? chapterRange(taught) : ALL_QUESTIONS,
    areaLabel: (area) => areaLabel(area, topicTitles),
  };
}

export const [getCourse, setCourse] = createContext<Course>();
