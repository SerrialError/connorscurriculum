import { describe, expect, it, vi } from 'vitest';
import { FEEDBACK_URL, type FeedbackForm, feedbackProblem, feedbackRequest, sendFeedback } from './feedback';

const form = (over: Partial<FeedbackForm> = {}): FeedbackForm => ({
  questionId: 'apchem-09-shape-nh3',
  kind: 'wrong-answer',
  comment: '  I think it is (B).  ',
  picked: 'b',
  website: '',
  ...over,
});
const page = 'https://connorscurriculum.com/apchem/practice/?chapters=9';

describe('feedbackProblem', () => {
  it('needs a kind, and a comment when the kind is "other"', () => {
    expect(feedbackProblem(form({ kind: '' }))).toBe('Choose what’s wrong.');
    expect(feedbackProblem(form({ kind: 'other', comment: '   ' }))).toBe('Say what the problem is.');
    expect(feedbackProblem(form({ kind: 'typo', comment: '' }))).toBeNull();
    expect(feedbackProblem(form())).toBeNull();
  });

  it('caps the comment at what the Worker accepts', () => {
    expect(feedbackProblem(form({ comment: 'x'.repeat(2000) }))).toBeNull();
    expect(feedbackProblem(form({ comment: 'x'.repeat(2001) }))).toMatch(/under 2000/);
  });
});

describe('feedbackRequest', () => {
  it('trims the comment and leaves out empty optional fields', () => {
    expect(feedbackRequest(form({ picked: undefined }), page)).toEqual({
      questionId: 'apchem-09-shape-nh3',
      kind: 'wrong-answer',
      comment: 'I think it is (B).',
      page,
    });
    expect(feedbackRequest(form(), page)).toMatchObject({ picked: 'b' });
    expect(feedbackRequest(form({ website: 'spam' }), page)).toMatchObject({ website: 'spam' });
  });
});

describe('sendFeedback', () => {
  it('posts JSON to the Worker', async () => {
    const fetchFn = vi.fn(async () => new Response('{"ok":true}', { status: 201 }));
    expect(await sendFeedback(form(), page, fetchFn)).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FEEDBACK_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({ questionId: 'apchem-09-shape-nh3', page });
  });

  it('passes on the Worker’s message, or a general one', async () => {
    const reply = (status: number, body: string) => vi.fn(async () => new Response(body, { status }));
    expect(await sendFeedback(form(), page, reply(429, '{"error":"Too much feedback at once."}'))).toEqual({
      ok: false,
      error: 'Too much feedback at once.',
    });
    expect(await sendFeedback(form(), page, reply(403, ''))).toEqual({ ok: false, error: 'Couldn’t send it. Try again later.' });
    const offline = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await sendFeedback(form(), page, offline)).toMatchObject({ ok: false, error: expect.stringMatching(/connection/) });
  });
});
