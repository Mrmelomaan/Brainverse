import type { Note } from './model';

const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

/**
 * Builds a Google Calendar "prefilled event" URL. Google opens its own editor with
 * the fields filled in; nothing is created until the user hits Save there.
 * Without `start`, Google picks the next free slot itself.
 */
export function gcalUrl(note: Note, opts?: { start?: Date; minutes?: number; origin?: string }) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: note.text.trim().slice(0, 200) });
  const lines: string[] = [];
  if (note.comments.length) lines.push(...note.comments.map((c) => '• ' + c.text));
  if (opts?.origin) lines.push('', 'From Brainverse: ' + opts.origin);
  if (lines.length) p.set('details', lines.join('\n'));
  if (opts?.start) {
    const end = new Date(opts.start.getTime() + (opts.minutes ?? 60) * 60_000);
    p.set('dates', fmt(opts.start) + '/' + fmt(end));
  }
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
