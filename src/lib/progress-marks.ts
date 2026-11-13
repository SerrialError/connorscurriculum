// Icons and labels for class-progress states, shared by every component that shows them.
// The text label always goes with the icon, so state is never shown by color or symbol alone.
import type { TopicProgress } from './registry';

type Status = Exclude<TopicProgress, null>;

export const PROGRESS_ICONS: Record<Status, string> = { done: '✓', review: '↺', partial: '◐', skipped: '!' };

export const PROGRESS_LABELS: Record<Status, string> = {
  done: 'Covered in class',
  review: 'Seen last year',
  partial: 'Partly covered',
  skipped: 'Skipped in class',
};
