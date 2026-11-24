// The data the practice island works with. Plain types, shared by the practice modules.

export interface PracticeChoice {
  id: string;
  html: string;
  /**
   * The choice as plain text (math written out), its radio button's name: Chrome names a label
   * that is only math (MathML) as empty.
   */
  text: string;
}

export interface PracticePart {
  label: string;
  promptHtml: string;
  points: number;
  scoringHtml: string[];
}

/**
 * What the setup screen, filters, and set picking need about a question: no text. The practice
 * page carries these for every question; the text loads per chapter when a set starts.
 */
export interface QuestionMeta {
  id: string;
  type: 'mcq' | 'frq';
  chapter: number;
  sections: string[];
  /** Topic ids like "5.4" (subject prefix removed). */
  cedTopics: string[];
  /** Unit ids derived from cedTopics. */
  units: string[];
  difficulty: number;
  /** Needs a numeric calculation (a practice exam can limit how many it draws). */
  calculation?: true;
  /** Related questions that give each other away; a practice exam draws at most one per group. */
  groups?: string[];
  /**
   * Not class material yet: a sample question, or one from a chapter the class hasn't reached.
   * Left out of practice unless its chapter is picked (see filterQuestions).
   */
  extra?: boolean;
}

interface PracticeQuestionBase extends Omit<QuestionMeta, 'type'> {
  promptHtml: string;
  /** The prompt as one line of plain text (math written out), for the results list. */
  promptText: string;
  image?: { src: string; width: number; height: number; alt: string };
  explanationHtml: string;
}

export interface McqQuestion extends PracticeQuestionBase {
  type: 'mcq';
  choices: PracticeChoice[];
  answer: string;
}

export interface FrqQuestion extends PracticeQuestionBase {
  type: 'frq';
  parts: PracticePart[];
}

export type PracticeQuestion = McqQuestion | FrqQuestion;

/** One section of a practice exam's multiple choice (tests.json; see registry.ts examSchema). */
export interface ExamSection {
  id: string;
  label: string;
  count: number;
  match: { chapters: number[]; sections: string[] };
  maxCalculations?: number;
}

/** A practice exam in a class test's format: its multiple-choice sections, extras, and FRQs. */
export interface PracticeExam {
  mcqPoints: number;
  sections: ExamSection[];
  /** Multiple-choice questions beyond the sections' counts, drawn from all of them together. */
  extra: number;
  frq: { count: number; points: number; calculations?: boolean };
  /** Only questions at least this hard are drawn (1 = any). */
  minDifficulty?: number;
  /** Question ids never drawn (in its chapters and sections, but off-topic for it). */
  exclude?: string[];
  /** What the screens call it: "exam" for a class test's practice exam, "quiz" for a practice quiz. */
  noun?: 'exam' | 'quiz';
}

export interface PracticeTest {
  id: string;
  title: string;
  /** A practice quiz written for the site, not a class test (tests.json kind). */
  kind?: 'test' | 'quiz';
  chapters: number[];
  sections: string[];
  exam?: PracticeExam;
}

export type Mode = 'all' | 'random' | 'weak';
export type QuestionType = 'mcq' | 'frq';

export type ApScope = 'ap' | 'class';

export interface Filters {
  chapters: number[];
  /** Textbook sections, e.g. "7.2": the practice links on a lesson page pick its sections. */
  sections: string[];
  test: string | null;
  units: string[];
  topics: string[];
  difficulty: number[];
  type: QuestionType | null;
  /** On the AP exam or not: 'ap' keeps questions tagged with an AP topic, 'class' keeps class-only ones. */
  ap: ApScope | null;
  /** Question order: as listed (chapter order), shuffled, or weakest topics first. */
  mode: Mode;
  /** How many questions to practice; null means every matching question. */
  n: number | null;
}

/** Per question: recent scores (0–1), newest last. Kept in localStorage. */
export type History = Record<string, number[]>;
