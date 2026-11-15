import { describe, expect, it } from 'vitest';
import { type KeyTarget, isTypingTarget } from './keyboard';

const el = (tagName: string, extra: Partial<KeyTarget> = {}, parentElement: KeyTarget | null = null): KeyTarget => ({
  tagName,
  parentElement,
  ...extra,
});

describe('isTypingTarget', () => {
  it('is true for anything that takes typing', () => {
    for (const type of ['text', 'search', 'number', 'email', 'url']) expect(isTypingTarget(el('INPUT', { type }))).toBe(true);
    expect(isTypingTarget(el('TEXTAREA'))).toBe(true);
    expect(isTypingTarget(el('SELECT'))).toBe(true);
    expect(isTypingTarget(el('DIV', { isContentEditable: true }))).toBe(true);
  });

  it('is false for the page, buttons, and choices you pick with a key', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(el('BODY'))).toBe(false);
    expect(isTypingTarget(el('BUTTON'))).toBe(false);
    expect(isTypingTarget(el('INPUT', { type: 'radio' }))).toBe(false);
    expect(isTypingTarget(el('INPUT', { type: 'checkbox' }))).toBe(false);
  });

  it('is true for anything inside an open dialog, and only while it is open', () => {
    const open = el('DIALOG', { open: true });
    expect(isTypingTarget(el('A', {}, el('LI', {}, open)))).toBe(true);
    expect(isTypingTarget(el('BUTTON', {}, el('DIALOG', { open: false })))).toBe(false);
  });
});
