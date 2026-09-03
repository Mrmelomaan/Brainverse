import { normaliseNote, type Note, type Prefs, type View } from './model';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function parseNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Note>;
  if (typeof r.id !== 'string' || !ID.test(r.id)) return null;
  const n = normaliseNote({ ...r, id: r.id });
  n.text = n.text.slice(0, 5000);
  n.comments = n.comments.slice(0, 200).map((c) => ({ ...c, id: String(c.id).slice(0, 64), text: c.text.slice(0, 2000) }));
  return n;
}

export function parsePrefs(raw: unknown): Prefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Prefs>;
  const view: View = (['category', 'project', 'priority'] as View[]).includes(r.view as View) ? (r.view as View) : 'category';
  return { view, rails: { _un: !!r.rails?._un, _done: !!r.rails?._done } };
}
