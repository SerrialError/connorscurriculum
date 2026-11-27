// Feedback on a practice question. The form under each question posts to the Worker's /feedback
// endpoint (src/feedback.js in SerrialError/sveltia-cms-auth), which files a GitHub issue, so
// students can report a problem without an account. The kinds must match feedbackKinds there.
import { WORKER_URL } from '../worker';

export const FEEDBACK_URL = `${WORKER_URL}/feedback`;

export const FEEDBACK_KINDS = [
  { id: 'wrong-answer', label: 'The answer is wrong' },
  { id: 'unclear', label: 'Confusing or unclear' },
  { id: 'typo', label: 'Typo or formatting problem' },
  { id: 'difficulty', label: 'Difficulty label is off' },
  { id: 'other', label: 'Something else' },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['id'];

/** The Worker rejects longer comments. */
export const MAX_COMMENT = 2000;

export interface FeedbackForm {
  questionId: string;
  kind: FeedbackKind | '';
  comment: string;
  /** The choice the student picked, for a multiple-choice question. */
  picked?: string;
  /** A field people never see; anything in it marks the sender as a bot. */
  website: string;
}

/** What's missing before the form can be sent, or null when it's ready. */
export function feedbackProblem(form: FeedbackForm): string | null {
  if (!form.kind) return 'Choose what’s wrong.';
  const comment = form.comment.trim();
  if (form.kind === 'other' && !comment) return 'Say what the problem is.';
  if (comment.length > MAX_COMMENT) return `Keep it under ${MAX_COMMENT} characters.`;
  return null;
}

/** The JSON the Worker expects. `page` is where the question was seen. */
export function feedbackRequest(form: FeedbackForm, page: string) {
  return {
    questionId: form.questionId,
    kind: form.kind,
    comment: form.comment.trim(),
    page,
    ...(form.picked ? { picked: form.picked } : {}),
    ...(form.website ? { website: form.website } : {}),
  };
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Post the feedback. Never throws: a failure comes back as a message to show. */
export async function sendFeedback(form: FeedbackForm, page: string, fetchFn: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await fetchFn(FEEDBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackRequest(form, page)),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'Couldn’t send it. Try again later.' };
  } catch {
    return { ok: false, error: 'Couldn’t reach the server. Check your connection and try again.' };
  }
}
