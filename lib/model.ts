// Domain model + constants shared by client and server.
import type { IconName } from './icons';

/** Category ids are per user (see UserCategory); a note keeps the id even if the category is later deleted. */
export type Category = string;
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
/** A user-defined life area. `hue` is an oklch hue (0–360) that tints the area's notes. */
export type UserCategory = { id: string; label: string; icon: IconName; hue: number };
/** A user-defined project cluster. */
export type UserProject = { id: string; label: string; icon: IconName };
export type Prefs = { view: View; rails: Rails; projects: UserProject[]; categories: UserCategory[] };
export const MAX_PROJECTS = 24;
export const MAX_PROJECT_LABEL = 40;
export const MAX_CATEGORIES = 24;
export const MAX_CATEGORY_LABEL = 40;
export type Focus = null | { type: 'cluster'; key: string } | { type: 'note'; key: string; noteId: string };

export type Dim = { id: string; label: string; icon: IconName; hue?: number; n?: Priority };

/** Curated life areas offered when creating a category. `re` is the keyword auto-routing for that area (English
 *  plus a few Dutch words); hues are spread so neighbouring suggestions never look alike. A category made from a
 *  suggestion keeps the suggestion's id (when free), so its routing survives a rename. */
export type CategorySuggestion = { id: string; label: string; icon: IconName; hue: number; re: RegExp };
export const CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  { id: 'sport', label: 'Sport', icon: 'dumbbell-01', hue: 150, re: /\b(run|gym|padel|train|stretch|bike|swim|workout|sport)/i },
  { id: 'food', label: 'Food', icon: 'restaurant-02', hue: 60, re: /\b(meal|eat|food|snack|sugar|cook|lunch|dinner)/i },
  { id: 'health', label: 'Health', icon: 'stethoscope', hue: 0, re: /\b(doctor|dentist|health|medic|pill|vitamin|sick|huisarts|tandarts|apotheek|dokter)/i },
  { id: 'sleep', label: 'Sleep', icon: 'moon-02', hue: 270, re: /\b(sleep|nap|bedtime|insomnia|slaap|slapen)/i },
  { id: 'habits', label: 'Habits', icon: 'repeat', hue: 310, re: /\b(read|sleep|phone|habit|journal|meditat|wake)/i },
  { id: 'mindfulness', label: 'Mindfulness', icon: 'yoga-01', hue: 200, re: /\b(meditat|mindful|breath|calm|yoga|stress|rust)/i },
  { id: 'family', label: 'Family', icon: 'user-multiple', hue: 30, re: /\b(mom|dad|mum|mother|father|parents|kids|son|daughter|family|familie|ouders|oma|opa|mama|papa)/i },
  { id: 'friends', label: 'Friends', icon: 'user-group', hue: 100, re: /\b(friend|mates|buddy|bbq|drinks|vriend|vrienden|borrel)/i },
  { id: 'relationship', label: 'Relationship', icon: 'favourite', hue: 350, re: /\b(partner|wife|husband|girlfriend|boyfriend|date night|anniversary|valentine|vriendin|relatie)/i },
  { id: 'home', label: 'Home', icon: 'home-01', hue: 80, re: /\b(clean|laundry|garden|repair|plumber|ikea|furniture|schoonmaken|huis|tuin|verhuiz)/i },
  { id: 'finance', label: 'Finance', icon: 'wallet-01', hue: 130, re: /\b(budget|saving|savings|bank|mortgage|insurance|pension|invest|sparen|hypotheek|verzekering|belasting)/i },
  { id: 'business', label: 'Business', icon: 'briefcase-01', hue: 240, re: /\b(invoice|rate|tax|numbers|revenue|boekhoud|kvk)/i },
  { id: 'career', label: 'Career', icon: 'chart-line-data-01', hue: 210, re: /\b(career|promotion|resume|cv|interview|linkedin|salary|sollicit|carri[eè]re)/i },
  { id: 'learning', label: 'Learning', icon: 'mortarboard-02', hue: 45, re: /\b(learn|course|study|lesson|tutorial|exam|cursus|leren|studeren)/i },
  { id: 'reading', label: 'Reading', icon: 'book-open-01', hue: 300, re: /\b(book|read|novel|chapter|library|lezen|boek)/i },
  { id: 'creativity', label: 'Creativity', icon: 'paint-board', hue: 330, re: /\b(draw|paint|sketch|design|write|craft|photo|creat|teken|schilder)/i },
  { id: 'music', label: 'Music', icon: 'music-note-01', hue: 290, re: /\b(music|song|guitar|piano|playlist|concert|band|muziek|gitaar)/i },
  { id: 'travel', label: 'Travel', icon: 'airplane-01', hue: 190, re: /\b(trip|travel|flight|hotel|vacation|holiday|passport|reis|vakantie|vlucht)/i },
  { id: 'nature', label: 'Nature', icon: 'tree-01', hue: 120, re: /\b(hike|walk|forest|beach|park|nature|outdoor|wandel|bos|strand|natuur)/i },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-cart-01', hue: 20, re: /\b(buy|shop|order|groceries|amazon|bol\.com|kopen|bestel|boodschap)/i },
  { id: 'errands', label: 'Errands', icon: 'task-01', hue: 170, re: /\b(pick up|drop off|post office|pharmacy|return|errand|ophalen|wegbrengen|regelen)/i },
  { id: 'admin', label: 'Admin', icon: 'file-01', hue: 250, re: /\b(form|renew|subscription|contract|paperwork|admin|gemeente|formulier|abonnement|opzeggen)/i },
  { id: 'fun', label: 'Fun', icon: 'game-controller-01', hue: 15, re: /\b(movie|film|game|netflix|series|party|festival|play|feest|spel)/i },
  { id: 'ideas', label: 'Ideas', icon: 'bulb', hue: 95, re: /\b(idea|what if|maybe|someday|brainstorm|idee|misschien)/i },
];
/** What a brand-new account starts with. Fixed ids, so the tutorial SEED and older notes land in them. */
export const STARTER_CATEGORIES: UserCategory[] = ['sport', 'food', 'habits', 'business'].map((id) => { const { label, icon, hue } = CATEGORY_SUGGESTIONS.find((s) => s.id === id)!; return { id, label, icon, hue }; });
/** Icons a user can pick for a custom category, and the hue swatches. Kept small on purpose; extend via scripts/extract-icons.mjs. */
export const CATEGORY_ICONS: IconName[] = ['dumbbell-01', 'restaurant-02', 'repeat', 'briefcase-01', 'stethoscope', 'moon-02', 'yoga-01', 'user-multiple', 'favourite', 'home-01', 'wallet-01', 'mortarboard-02', 'paint-board', 'airplane-01', 'tree-01', 'bulb'];
export const CATEGORY_HUES: number[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
export const defaultPrefs = (): Prefs => ({ view: 'category', rails: { _un: false, _done: false }, projects: [], categories: STARTER_CATEGORIES.map((c) => ({ ...c })) });
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
export const catOf = (categories: UserCategory[], id: string | null | undefined) => (id ? categories.find((c) => c.id === id) : undefined);
export const projOf = (projects: UserProject[], id: string | null | undefined) => (id ? projects.find((p) => p.id === id) : undefined);
/** The suggestion a category came from: same id, or (for a custom one) the same name. */
export const suggestionFor = (c: Pick<UserCategory, 'id' | 'label'>) => CATEGORY_SUGGESTIONS.find((s) => s.id === c.id) ?? CATEGORY_SUGGESTIONS.find((s) => s.label.toLowerCase() === c.label.trim().toLowerCase());

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (label: string) => (label.trim() ? new RegExp('(^|\\W)' + escapeRe(label.trim()) + '(\\W|$)', 'i') : null);

export type Draft = { text: string; category: Category | null; project: Project | null; priority: Priority | null };
export const emptyDraft = (): Draft => ({ text: '', category: null, project: null, priority: null });

/** Keyword auto-routing: only when neither category nor project was chosen. A project wins when its name
 *  appears in the text; otherwise the first category (in the user's order) whose name or suggestion keywords match. */
export function routeDraft(d: Draft, projects: UserProject[] = [], categories: UserCategory[] = []): Draft & { auto: boolean } {
  if (d.category || d.project) return { ...d, auto: false };
  const out: Draft & { auto: boolean } = { ...d, auto: false };
  const proj = projects.find((p) => wordRe(p.label)?.test(d.text));
  if (proj) return { ...out, project: proj.id, auto: true };
  const cat = categories.find((c) => wordRe(c.label)?.test(d.text) || suggestionFor(c)?.re.test(d.text));
  if (cat) return { ...out, category: cat.id, auto: true };
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
    category: typeof raw.category === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.category) ? raw.category : null,
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
