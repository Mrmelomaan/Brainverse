// Domain model + constants shared by client and server.
import type { IconName } from './icons';

export type Category = 'sport' | 'food' | 'habits' | 'business';
/** Project ids are per user (see UserProject); a note keeps the id even if the project is later deleted. */
export type Project = string;
export type Priority = 1 | 2 | 3;
export type View = 'category' | 'project' | 'priority';

export type Comment = { id: string; text: string; at: string /* ISO */ };
export type Note = {
  id: string;
  text: string;
  category: Category | null;
  project: Project | null;
  priority: Priority | null;
  done: boolean;
  comments: Comment[];
  createdAt: string; // ISO, creation order is the tiebreak sort
};
export type Rails = { _un: boolean; _done: boolean };
/** A user-defined project cluster. Categories are fixed by the product; projects belong to the user. */
export type UserProject = { id: string; label: string; icon: IconName };
export type Prefs = { view: View; rails: Rails; projects: UserProject[] };
export const MAX_PROJECTS = 24;
export const MAX_PROJECT_LABEL = 40;
export const defaultPrefs = (): Prefs => ({ view: 'category', rails: { _un: false, _done: false }, projects: [] });
export type Focus = null | { type: 'cluster'; key: string } | { type: 'note'; key: string; noteId: string };

export type Dim = { id: string; label: string; icon: IconName; hue?: number; n?: Priority };

export const CATS: (Dim & { id: Category; hue: number })[] = [
  { id: 'sport', label: 'Sport', icon: 'dumbbell-01', hue: 150 },
  { id: 'food', label: 'Food', icon: 'restaurant-02', hue: 60 },
  { id: 'habits', label: 'Habits', icon: 'repeat', hue: 310 },
  { id: 'business', label: 'Business', icon: 'briefcase-01', hue: 240 },
];
/** Icons a user can pick for a project. Kept small on purpose; extend via scripts/extract-icons.mjs. */
export const PROJECT_ICONS: IconName[] = ['rocket-01', 'folder-01', 'home-01', 'laptop', 'camera-01', 'paint-board', 'book-open-01', 'airplane-01', 'favourite', 'star', 'money-bag-01', 'plant-01', 'music-note-01', 'shopping-cart-01', 'user-group', 'target-01'];
export const PRIOS: (Dim & { id: 'P1' | 'P2' | 'P3'; n: Priority })[] = [
  { id: 'P1', n: 1, label: 'P1 · Now', icon: 'flash' },
  { id: 'P2', n: 2, label: 'P2 · Soon', icon: 'clock-01' },
  { id: 'P3', n: 3, label: 'P3 · Someday', icon: 'moon' },
];
export const VIEWS: { id: View; label: string }[] = [
  { id: 'category', label: 'Categories' },
  { id: 'project', label: 'Projects' },
  { id: 'priority', label: 'Priority' },
];
export const catOf = (id: string | null | undefined) => CATS.find((c) => c.id === id);
export const projOf = (projects: UserProject[], id: string | null | undefined) => (id ? projects.find((p) => p.id === id) : undefined);

export const ROUTES: [RegExp, Category][] = [
  [/\b(run|gym|padel|train|stretch|bike|swim|workout|sport)/i, 'sport'],
  [/\b(meal|eat|food|snack|sugar|cook|lunch|dinner)/i, 'food'],
  [/\b(read|sleep|phone|habit|journal|meditat|wake)/i, 'habits'],
  [/\b(invoice|rate|tax|numbers|revenue|boekhoud|kvk)/i, 'business'],
];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Draft = { text: string; category: Category | null; project: Project | null; priority: Priority | null };
export const emptyDraft = (): Draft => ({ text: '', category: null, project: null, priority: null });

/** Keyword auto-routing: only when neither category nor project was chosen. A project wins when its name
 *  appears in the text; otherwise the first matching category keyword. */
export function routeDraft(d: Draft, projects: UserProject[] = []): Draft & { auto: boolean } {
  if (d.category || d.project) return { ...d, auto: false };
  const out: Draft & { auto: boolean } = { ...d, auto: false };
  const proj = projects.find((p) => p.label.trim() && new RegExp('(^|\\W)' + escapeRe(p.label.trim()) + '(\\W|$)', 'i').test(d.text));
  if (proj) return { ...out, project: proj.id, auto: true };
  for (const [re, id] of ROUTES) {
    if (re.test(d.text)) return { ...out, category: id, auto: true };
  }
  return out;
}

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'n' + Date.now() + Math.random().toString(36).slice(2, 8));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** "Thu 21:38" from an ISO timestamp. */
export function stamp(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + hh + ':' + mm;
}

/** Normalise anything that came from storage into a well-formed Note. */
export function normaliseNote(raw: Partial<Note> & { id: string }, idx = 0): Note {
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map((c, i) => ({ id: c.id || raw.id + '-c' + i, text: String(c.text ?? ''), at: c.at && !isNaN(new Date(c.at).getTime()) ? c.at : new Date(0).toISOString() }))
    : [];
  const pr = raw.priority;
  return {
    id: raw.id,
    text: String(raw.text ?? ''),
    category: catOf(raw.category) ? (raw.category as Category) : null,
    project: typeof raw.project === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.project) ? raw.project : null,
    priority: pr === 1 || pr === 2 || pr === 3 ? pr : null,
    done: !!raw.done,
    comments,
    createdAt: raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : new Date(Date.now() - 1e6 + idx).toISOString(),
  };
}

/** First-run notes for a brand-new universe. They teach the tool and nothing else; the server inserts
 *  them once (with fresh ids) the first time an account loads its universe. */
export const SEED: Omit<Note, 'id' | 'createdAt'>[] = [
  { text: 'Press N or the + button to drop a new thought. Enter saves it.', category: null, project: null, priority: 1, done: false, comments: [] },
  { text: 'Open a note to give it a life area, a project and a priority. Untagged notes wait here in Unsorted.', category: null, project: null, priority: 2, done: false, comments: [] },
  { text: 'Tab (or swipe on a phone) switches between Categories, Projects and Priority. Same notes, different sky.', category: null, project: null, priority: 2, done: false, comments: [] },
  { text: 'Projects are yours to name. Head to the Projects view to create the first one, then mark these notes done.', category: null, project: null, priority: 3, done: false, comments: [] },
];
