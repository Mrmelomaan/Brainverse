import { CATEGORY_ICONS, CATEGORY_SUGGESTIONS, MAX_CATEGORIES, MAX_CATEGORY_LABEL, MAX_PROJECTS, MAX_PROJECT_LABEL, PROJECT_ICONS, normaliseNote, type Note, type Prefs, type UserCategory, type UserProject, type View } from './model';
import type { IconName } from './icons';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_TEXT = 5000;
export const MAX_COMMENTS = 50;
export const MAX_COMMENT = 1000;
/** Largest request body any write endpoint accepts. A bug in the client, not a person, is what this bounds. */
export const MAX_BODY_BYTES = 1_000_000;

export const isId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** Reject oversized bodies before parsing them. Returns null when the request is acceptable. */
export function tooLarge(req: Request): boolean {
  const len = Number(req.headers.get('content-length') ?? 0);
  return Number.isFinite(len) && len > MAX_BODY_BYTES;
}

export function parseNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Note>;
  if (!isId(r.id)) return null;
  const n = normaliseNote({ ...r, id: r.id });
  n.text = n.text.slice(0, MAX_TEXT);
  n.comments = n.comments.slice(0, MAX_COMMENTS).map((c) => ({ ...c, id: String(c.id).slice(0, 64), text: c.text.slice(0, MAX_COMMENT) }));
  return n;
}

export function parseProjects(raw: unknown): UserProject[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: UserProject[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { id, label, icon } = p as Partial<UserProject>;
    if (!isId(id) || seen.has(id) || typeof label !== 'string') continue;
    const text = label.trim().slice(0, MAX_PROJECT_LABEL);
    if (!text) continue;
    seen.add(id);
    out.push({ id, label: text, icon: PROJECT_ICONS.includes(icon as IconName) ? (icon as IconName) : PROJECT_ICONS[0] });
    if (out.length >= MAX_PROJECTS) break;
  }
  return out;
}

const CATEGORY_ICON_SET = new Set<IconName>([...CATEGORY_ICONS, ...CATEGORY_SUGGESTIONS.map((s) => s.icon)]);

export function parseCategories(raw: unknown): UserCategory[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: UserCategory[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const { id, label, icon, hue } = c as Partial<UserCategory>;
    if (!isId(id) || seen.has(id) || typeof label !== 'string') continue;
    const text = label.trim().slice(0, MAX_CATEGORY_LABEL);
    if (!text) continue;
    seen.add(id);
    const h = typeof hue === 'number' && Number.isFinite(hue) ? Math.min(360, Math.max(0, Math.round(hue))) : 0;
    out.push({ id, label: text, icon: CATEGORY_ICON_SET.has(icon as IconName) ? (icon as IconName) : CATEGORY_ICONS[0], hue: h });
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out;
}

export function parsePrefs(raw: unknown): Prefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Prefs>;
  const view: View = (['category', 'project', 'priority'] as View[]).includes(r.view as View) ? (r.view as View) : 'category';
  return { view, rails: { _un: !!r.rails?._un, _done: !!r.rails?._done }, projects: parseProjects(r.projects), categories: parseCategories(r.categories) };
}
