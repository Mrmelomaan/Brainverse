// Domain model + constants shared by client and server.
import type { IconName } from './icons';

export type Category = 'sport' | 'food' | 'habits' | 'business';
export type Project = 'vita' | 'mb' | 'acq' | 'client';
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
export type Prefs = { view: View; rails: Rails };
export type Focus = null | { type: 'cluster'; key: string } | { type: 'note'; key: string; noteId: string };

export type Dim = { id: string; label: string; icon: IconName; hue?: number; n?: Priority };

export const CATS: (Dim & { id: Category; hue: number })[] = [
  { id: 'sport', label: 'Sport', icon: 'dumbbell-01', hue: 150 },
  { id: 'food', label: 'Food', icon: 'restaurant-02', hue: 60 },
  { id: 'habits', label: 'Habits', icon: 'repeat', hue: 310 },
  { id: 'business', label: 'Business', icon: 'briefcase-01', hue: 240 },
];
export const PROJS: (Dim & { id: Project })[] = [
  { id: 'vita', label: 'Vita', icon: 'smart-phone-01' },
  { id: 'mb', label: 'Mooi Bekeken', icon: 'camera-01' },
  { id: 'acq', label: 'Aquisitie', icon: 'target-01' },
  { id: 'client', label: 'Client projects', icon: 'user-group' },
];
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
export const projOf = (id: string | null | undefined) => PROJS.find((p) => p.id === id);

export const ROUTES: [RegExp, 'category' | 'project', Category | Project][] = [
  [/\b(run|gym|padel|train|stretch|bike|swim|workout)/i, 'category', 'sport'],
  [/\b(meal|eat|food|snack|sugar|cook|lunch|dinner)/i, 'category', 'food'],
  [/\b(read|sleep|phone|habit|journal|meditat|wake)/i, 'category', 'habits'],
  [/\b(invoice|rate|tax|numbers|revenue|boekhoud|kvk)/i, 'category', 'business'],
  [/vita/i, 'project', 'vita'],
  [/\b(blog|portfolio|site|website|seo|mooi bekeken)/i, 'project', 'mb'],
  [/\b(lead|linkedin|follow.?up|acquisitie|aquisitie|pitch|offerte)/i, 'project', 'acq'],
  [/\b(client|klant|deliver|shoot)/i, 'project', 'client'],
];

export type Draft = { text: string; category: Category | null; project: Project | null; priority: Priority | null };
export const emptyDraft = (): Draft => ({ text: '', category: null, project: null, priority: null });

/** Keyword auto-routing: only when neither category nor project was chosen; first match wins. */
export function routeDraft(d: Draft): Draft & { auto: boolean } {
  if (d.category || d.project) return { ...d, auto: false };
  const out: Draft & { auto: boolean } = { ...d, auto: false };
  for (const [re, dim, id] of ROUTES) {
    if (re.test(d.text)) {
      if (dim === 'category') out.category = id as Category;
      else out.project = id as Project;
      out.auto = true;
      break;
    }
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
    project: projOf(raw.project) ? (raw.project as Project) : null,
    priority: pr === 1 || pr === 2 || pr === 3 ? pr : null,
    done: !!raw.done,
    comments,
    createdAt: raw.createdAt && !isNaN(new Date(raw.createdAt).getTime()) ? raw.createdAt : new Date(Date.now() - 1e6 + idx).toISOString(),
  };
}

// Demo content shown on a fresh universe (same as the design prototype).
const T0 = Date.now() - 20 * 60_000;
const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
export const SEED: Note[] = (
  [
    { text: 'Run 3x this week, before work', category: 'sport', priority: 2 },
    { text: 'Book padel court for Thursday', category: 'sport', comments: [{ text: 'Rens can only do 19:00 or later', at: at(30) }, { text: 'Court 3 is the good one', at: at(29.9) }] },
    { text: 'Stretch routine after every desk day', category: 'sport', priority: 3 },
    { text: 'Meal prep Sunday: 4 lunches', category: 'food', priority: 2 },
    { text: 'Kill the 15:00 sugar snack', category: 'food' },
    { text: 'Read 20 pages before touching the phone', category: 'habits', priority: 1 },
    { text: 'Phone off at 22:30', category: 'habits' },
    { text: 'Raise hourly rate for new clients in Q4', category: 'business', project: 'acq', priority: 2 },
    { text: 'Quarterly numbers review, block a morning', category: 'business', priority: 3 },
    { text: 'Sketch the Vita onboarding flow', project: 'vita', priority: 1 },
    { text: 'Decide: Supabase or Firebase for Vita', project: 'vita', priority: 2, comments: [{ text: 'Supabase has row-level security out of the box', at: at(50) }] },
    { text: 'Blog: branding photography for MKB', project: 'mb', category: 'business', priority: 2 },
    { text: 'Update portfolio with the sports series', project: 'mb', priority: 3 },
    { text: 'Fix contact form spam on the site', project: 'mb', priority: 1 },
    { text: 'Follow up 3 leads from the netwerkborrel', project: 'acq', priority: 1 },
    { text: 'LinkedIn post: behind the scenes of last shoot', project: 'acq' },
    { text: 'Deliver edited photos, Friday latest', project: 'client', priority: 1 },
    { text: 'Idea: a tiny app that tracks coffee intake' },
    { text: 'Send invoice for June shoot', project: 'client', done: true },
    { text: 'Cancel unused SaaS subscriptions', category: 'business', done: true },
  ] as Partial<Note>[]
).map((n, i) => normaliseNote({ id: 'seed-' + i, createdAt: new Date(T0 + i * 1000).toISOString(), ...n } as Partial<Note> & { id: string }, i));
