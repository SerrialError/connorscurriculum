// Callout types, shared by Callout.astro and the CMS lesson preview.
export const CALLOUT_TYPES = {
  note: { icon: 'ℹ', text: 'Note' },
  warning: { icon: '⚠', text: 'Watch out' },
  'ap-tip': { icon: '★', text: 'AP tip' },
  'not-on-ap': { icon: '⊘', text: 'Not on the AP exam' },
} as const;

export type CalloutType = keyof typeof CALLOUT_TYPES;
