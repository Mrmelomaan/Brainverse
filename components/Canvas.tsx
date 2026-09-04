'use client';
// Brainverse canvas: a near 1:1 port of the design prototype's logic class (see design_handoff_brainverse/).
// Class component on purpose: the prototype keeps pointer/pinch/cooldown state on the instance, and that ports cleanly.
import React from 'react';
import { signOut } from 'next-auth/react';
import { Icon } from './Icon';
import { Sky, makeDrifters, type Drifter } from './Sky';
import { Sync, type SyncStatus } from '@/lib/sync';
import { gcalUrl } from '@/lib/calendar';
import {
  CATS, PRIOS, VIEWS, MAX_PROJECTS, MAX_PROJECT_LABEL, PROJECT_ICONS, catOf, clamp, emptyDraft, projOf, routeDraft, stamp, uid,
  type Category, type Dim, type Draft, type Focus, type Note, type Prefs, type Priority, type Rails, type UserProject, type View,
} from '@/lib/model';
import type { IconName } from '@/lib/icons';

type Account = { id: string; email: string; name: string | null };
type Props = { initial: { notes: Note[]; prefs: Prefs; account: Account }; origin?: string };
type Plan = { date: string; time: string; minutes: number };
type ProjEdit = { id?: string; label: string; icon: IconName };
type S = {
  view: View; notes: Note[]; rails: Rails; projects: UserProject[]; pan: { x: number; y: number }; zoom: number; glide: boolean; focus: Focus; focusZoom: number;
  cIdx: number; commentDraft: string; adding: boolean; draft: Draft; vw: number; vh: number; toast: string | null; flash: string | null;
  ready: boolean; drifters: Drifter[]; sync: SyncStatus; plan: Plan; menu: boolean; projEdit: ProjEdit | null; busy: boolean;
};
/** `ghost` marks the "new project" prompt: it is laid out like a cluster but can never hold notes or focus. */
type Group = { key: string; label: string; icon: IconName; rail?: boolean; ghost?: boolean; notes: Note[] };
type Placed = { g: Group; x: number; y: number; w: number; h: number; collapsed: boolean };

/** Browser storage is only used for tiny per-account conveniences (the mobile hint). Notes never live here:
 *  the server is the single source of truth, so two accounts on one browser can never see each other. */
const LS_PREFIX = 'brainverse.';
const NEW_KEY = '_new';
function clearLocal() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* private mode */ }
}
const OX = 'var(--font-oxygen), Oxygen, sans-serif';
const tint = (hue: number | null, a: number) => (hue == null ? `rgba(255,255,255,${a * 0.7})` : `oklch(80% 0.13 ${hue} / ${a})`);
const defaultPlan = (): Plan => {
  const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:00`, minutes: 60 };
};

export default class Canvas extends React.Component<Props, S> {
  pointers = new Map<number, { x: number; y: number }>();
  pinch: { d0: number; mid0: { x: number; y: number }; z0: number; p0: { x: number; y: number } } | null = null;
  drag: { sx: number; sy: number; px: number; py: number } | null = null;
  /** Mobile flick candidate: start point/time of a single pointer (tracked even when it starts on a tile). */
  flick: { id: number; x: number; y: number; t: number } | null = null;
  /** Set when a mobile pinch already triggered a focus change, so the release does not refit. */
  pinchActed = false;
  moved = false;
  cool = 0;
  tt: ReturnType<typeof setTimeout> | undefined;
  rootRef = React.createRef<HTMLDivElement>();
  worldRef = React.createRef<HTMLDivElement>();
  sync: Sync;
  unsub?: () => void;
  /** Real rendered cluster heights (world units), keyed by cluster key; replaces the estimate once known. */
  measured = new Map<string, number>();
  onR!: () => void;
  onK!: (e: KeyboardEvent) => void;
  onW!: (e: WheelEvent) => void;

  /** Per-account localStorage prefix. */
  ls: string;

  constructor(props: Props) {
    super(props);
    this.sync = new Sync();
    this.ls = LS_PREFIX + props.initial.account.id + '.';
    const vw = 1280, vh = 800;
    const st: S = {
      view: props.initial.prefs.view, notes: props.initial.notes, rails: props.initial.prefs.rails, projects: props.initial.prefs.projects, pan: { x: 0, y: 0 }, zoom: 1, glide: false, focus: null, focusZoom: 1,
      cIdx: 0, commentDraft: '', adding: false, draft: emptyDraft(), vw, vh, toast: null, flash: null, ready: false, drifters: [], sync: 'synced', plan: defaultPlan(), menu: false, projEdit: null, busy: false,
    };
    st.zoom = this.fitZoom(st); st.pan = this.centerPan(st);
    this.state = st;
  }

  componentDidMount() {
    // Older builds cached the whole universe under un-namespaced keys; sweep those so nothing from a
    // previous account lingers in this browser.
    try { ['notes', 'view', 'rails', 'hint'].forEach((k) => localStorage.removeItem(LS_PREFIX + k)); } catch { /* private mode */ }
    const ns = { ...this.state, vw: window.innerWidth, vh: window.innerHeight };
    this.setState({ vw: ns.vw, vh: ns.vh, zoom: this.fitZoom(ns), pan: this.centerPan(ns), ready: true, drifters: makeDrifters() });
    this.unsub = this.sync.onStatus((sync) => this.setState({ sync }));
    if (document.fonts?.ready) document.fonts.ready.then(() => this.measure());
    if (ns.vw < 640) { try { if (!localStorage.getItem(this.ls + 'hint')) { localStorage.setItem(this.ls + 'hint', '1'); this.toast('Swipe ← → to move · pinch to zoom in or out', 5000); } } catch { /* private mode */ } }

    this.onR = () => { const ns = { ...this.state, vw: window.innerWidth, vh: window.innerHeight }; if (this.state.focus) this.setState({ vw: ns.vw, vh: ns.vh }); else this.setState({ vw: ns.vw, vh: ns.vh, zoom: this.fitZoom(ns), pan: this.centerPan(ns) }); };
    window.addEventListener('resize', this.onR);
    this.onK = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = /TEXTAREA|INPUT|SELECT/.test(t?.tagName || '');
      const f = this.state.focus;
      if (this.state.projEdit) { if (e.key === 'Escape') this.setState({ projEdit: null }); return; }
      if (this.state.menu) { if (e.key === 'Escape') this.setState({ menu: false }); return; }
      if (e.key === 'Enter' && e.shiftKey && !this.state.adding) { e.preventDefault(); this.quickAddHere(); return; }
      if (e.key === 'Tab' && !this.state.adding && !typing) { e.preventDefault(); const i = VIEWS.findIndex((v) => v.id === this.state.view); const next = VIEWS[(i + (e.shiftKey ? -1 : 1) + VIEWS.length) % VIEWS.length].id; this.setView(next); return; }
      if (!typing && !this.state.adding) {
        if (e.key === 'ArrowUp') { e.preventDefault(); this.dive(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (f) this.back(); return; }
        if (f && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); this.step(e.key === 'ArrowLeft' ? -1 : 1); return; }
      }
      if (e.key === 'Escape') { if (this.state.adding) this.setState({ adding: false }); else if (f) this.back(); }
      else if (!typing && !this.state.adding && (e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); this.setState({ adding: true }); }
    };
    window.addEventListener('keydown', this.onK);
    this.onW = (e: WheelEvent) => { e.preventDefault(); const f = Math.exp(-e.deltaY * 0.0018); this.zoomAt(e.clientX, e.clientY, this.state.zoom * f); };
    this.rootRef.current?.addEventListener('wheel', this.onW, { passive: false });
  }
  componentDidUpdate() { this.measure(); }
  /** Read real cluster heights; re-layout when they differ from what was used. */
  measure() {
    if (!this.state.ready) return;
    let changed = false;
    this.rootRef.current?.querySelectorAll<HTMLElement>('[data-cluster][data-key]').forEach((el) => {
      const key = el.dataset.key!; if (el.dataset.collapsed === '1') return;
      const h = el.offsetHeight; if (h > 0 && Math.abs((this.measured.get(key) ?? -1) - h) > 1) { this.measured.set(key, h); changed = true; }
    });
    if (changed) this.forceUpdate();
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.onR); window.removeEventListener('keydown', this.onK);
    this.rootRef.current?.removeEventListener('wheel', this.onW); this.unsub?.();
  }

  // ---------- persistence ----------
  pushPrefs(patch: Partial<Prefs>) { const { view, rails, projects } = this.state; this.sync.prefs({ view, rails, projects, ...patch }); }
  setView(view: View) { this.overview({ view }); this.pushPrefs({ view }); }
  setRails(rails: Rails) { this.pushPrefs({ rails }); }
  setProjects(projects: UserProject[]) { this.setState({ projects }); this.pushPrefs({ projects }); }

  // ---------- projects ----------
  openProjectEditor(id?: string) {
    const p = id ? projOf(this.state.projects, id) : undefined;
    if (id && !p) return;
    if (!id && this.state.projects.length >= MAX_PROJECTS) { this.toast('That is the maximum number of projects'); return; }
    this.setState({ projEdit: p ? { id: p.id, label: p.label, icon: p.icon } : { label: '', icon: PROJECT_ICONS[0] }, menu: false });
  }
  saveProject() {
    const e = this.state.projEdit; if (!e) return;
    const label = e.label.trim().slice(0, MAX_PROJECT_LABEL); if (!label) return;
    const existing = e.id ? projOf(this.state.projects, e.id) : undefined;
    const projects = existing ? this.state.projects.map((p) => (p.id === e.id ? { ...p, label, icon: e.icon } : p)) : [...this.state.projects, { id: uid(), label, icon: e.icon }];
    this.setProjects(projects);
    this.setState({ projEdit: null });
    this.toast(existing ? 'Project updated' : 'Project created');
  }
  deleteProject(id: string) {
    const p = projOf(this.state.projects, id); if (!p) return;
    const projects = this.state.projects.filter((x) => x.id !== id);
    const stranded = this.state.notes.filter((n) => n.project === id && !n.done).length;
    this.setProjects(projects);
    this.setState({ projEdit: null });
    if (this.state.focus?.key === id) this.overview();
    this.toast(stranded ? `Project removed, ${stranded} note${stranded === 1 ? '' : 's'} moved to Unsorted` : 'Project removed');
  }

  // ---------- account ----------
  async signOutNow() { clearLocal(); await signOut({ callbackUrl: '/login' }); }
  async deleteAccountNow() {
    if (this.state.busy) return;
    if (!window.confirm('Delete your account and every note in it? This cannot be undone. Export first if you want a copy.')) return;
    this.setState({ busy: true, menu: false });
    try {
      const res = await fetch('/api/account', { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      clearLocal();
      await signOut({ callbackUrl: '/login' });
    } catch {
      this.setState({ busy: false });
      this.toast('Could not delete right now, try again');
    }
  }

  // ---------- layout ----------
  lp(s: Pick<S, 'vw' | 'rails'>) {
    const mobile = s.vw < 640; const W = mobile ? Math.min(360, s.vw - 28) : 340; const railW = 280, railC = 56, gapX = 44, gapY = 44;
    const leftW = mobile ? W : s.rails._un ? railC : railW, rightW = mobile ? W : s.rails._done ? railC : railW;
    const cols = mobile ? 1 : clamp(Math.floor((s.vw - 48 - leftW - rightW - 2 * gapX + gapX) / (W + gapX)), 1, 3);
    return { mobile, cols, W, gapX, gapY, railW, railC, leftW, rightW, worldW: mobile ? W : leftW + gapX + cols * (W + gapX) + rightW };
  }
  fitZoom(s: Pick<S, 'vw' | 'rails'>) { const { worldW, mobile } = this.lp(s); return mobile ? 1 : Math.min(1, (s.vw - 32) / worldW); }
  centerPan(s: Pick<S, 'vw' | 'rails'>) { const { worldW, mobile } = this.lp(s); const z = this.fitZoom(s); return { x: Math.round((s.vw - worldW * z) / 2), y: mobile ? 96 : 120 }; }
  overview(extra?: Partial<S>) { const s = { ...this.state, ...(extra || {}) }; this.cool = Date.now() + 700; this.setState({ ...(extra || {}), focus: null, zoom: this.fitZoom(s), pan: this.centerPan(s), glide: true } as S); }
  estH(n: number, W: number) { const perRow = W < 200 ? 1 : 2; const rows = Math.ceil(n / perRow); return 74 + (n ? rows * 94 + (rows - 1) * 10 : 44); }
  groups() {
    const { view, notes, projects } = this.state;
    const dims: Dim[] = view === 'category' ? CATS : view === 'project' ? projects : PRIOS;
    const keyOf = (n: Note) => (view === 'category' ? n.category : view === 'project' ? n.project : n.priority ? 'P' + n.priority : null);
    const groups: Group[] = dims.map((d) => ({ key: d.id, label: d.label, icon: d.icon, notes: [] }));
    // The Projects view always ends with a prompt: "create your first project" when there are none, "new project" after that.
    if (view === 'project') groups.push({ key: NEW_KEY, label: projects.length ? 'New project' : 'Create your first project', icon: 'add-01', ghost: true, notes: [] });
    const un: Group = { key: '_un', label: 'Unsorted', icon: 'inbox', rail: true, notes: [] }, done: Group = { key: '_done', label: 'Done', icon: 'checkmark-circle-02', rail: true, notes: [] };
    notes.forEach((n) => { if (n.done) return done.notes.push(n); (groups.find((g) => g.key === keyOf(n)) || un).notes.push(n); });
    if (view !== 'priority') { const byPrio = (a: Note, b: Note) => (a.priority || 9) - (b.priority || 9); [...groups, un].forEach((g) => g.notes.sort(byPrio)); }
    return { un, groups, done };
  }
  placed(): Placed[] {
    const s = this.state; const L = this.lp(s); const { un, groups, done } = this.groups(); const out: Placed[] = [];
    const put = (g: Group, x: number, y: number, w: number, collapsed?: boolean) => { const h = collapsed ? (L.mobile ? 52 : 200) : this.measured.get(g.key) ?? this.estH(g.notes.length, w); out.push({ g, x, y, w, h, collapsed: !!collapsed }); return h; };
    if (L.mobile) { let y = 0; y += put(un, 0, y, L.W, s.rails._un) + L.gapY; groups.forEach((g) => { y += put(g, 0, y, L.W) + L.gapY; }); put(done, 0, y, L.W, s.rails._done); }
    else {
      put(un, 0, 0, L.leftW, s.rails._un); const x0 = L.leftW + L.gapX; let y = 0;
      for (let i = 0; i < groups.length; i += L.cols) { const row = groups.slice(i, i + L.cols); const rowH = Math.max(...row.map((g) => this.measured.get(g.key) ?? this.estH(g.notes.length, L.W))); row.forEach((g, ci) => put(g, x0 + ci * (L.W + L.gapX), y, L.W)); y += rowH + L.gapY; }
      put(done, x0 + L.cols * (L.W + L.gapX), 0, L.rightW, s.rails._done);
    }
    return out;
  }

  // ---------- focus / zoom ----------
  zoomAt(cx: number, cy: number, nz: number) {
    const s = this.state; nz = clamp(nz, 0.3, 3.4); if (Date.now() < this.cool) return;
    if (s.focus && nz < s.focusZoom * 0.8) { this.back(); return; }
    const k = nz / s.zoom; this.setState({ zoom: nz, glide: false, pan: { x: cx - (cx - s.pan.x) * k, y: cy - (cy - s.pan.y) * k } });
  }
  focusCluster(key: string) {
    const s = this.state; const c = this.placed().find((p) => p.g.key === key); if (!c) return;
    const scale = clamp(Math.min((s.vw - 40) / c.w, (s.vh - 150) / c.h), 0.6, 1.9);
    const x = (s.vw - c.w * scale) / 2 - c.x * scale; const y = Math.max(96, (s.vh - c.h * scale) / 2) - c.y * scale;
    this.cool = Date.now() + 700; this.setState({ focus: { type: 'cluster', key }, focusZoom: scale, zoom: scale, pan: { x, y }, glide: true });
  }
  focusNote(noteId: string, clusterKey: string, rect: DOMRect) {
    const s = this.state; const { mobile } = this.lp(s);
    let tx = s.pan.x, ty = s.pan.y, sc = s.zoom;
    try { const m = new DOMMatrix(getComputedStyle(this.worldRef.current!).transform); if (m.a) { tx = m.e; ty = m.f; sc = m.a; } } catch { /* fallback to state */ }
    const nx = (rect.left - tx) / sc, ny = (rect.top - ty) / sc, nw = rect.width / sc, nh = rect.height / sc;
    const panelW = s.vw >= 900 ? 420 : 0;
    const scale = mobile ? clamp(Math.min((s.vw - 60) / nw, (s.vh * 0.34) / nh), 1, 2.6) : clamp(Math.min(380 / nw, (s.vh - 200) / nh), 1.2, 3);
    const cx = mobile ? s.vw / 2 : (s.vw - panelW) / 2, cy = mobile ? s.vh * 0.22 : s.vh / 2;
    this.cool = Date.now() + 700;
    this.setState({ focus: { type: 'note', key: clusterKey, noteId }, focusZoom: scale, zoom: scale, pan: { x: cx - (nx + nw / 2) * scale, y: cy - (ny + nh / 2) * scale }, glide: true, cIdx: 0, commentDraft: '', plan: defaultPlan() });
  }
  goNote(id: string, key: string) { const elm = document.querySelector(`[data-note-id="${id}"]`); if (elm) this.focusNote(id, key, elm.getBoundingClientRect()); }
  step(dir: number) {
    const f = this.state.focus; if (!f) return; const wrap = (i: number, n: number) => ((i % n) + n) % n;
    if (f.type === 'cluster') { const keys = this.placed().filter((p) => !p.collapsed && !p.g.ghost).map((p) => p.g.key); if (keys.length < 2) return; this.focusCluster(keys[wrap(keys.indexOf(f.key) + dir, keys.length)]); return; }
    const { un, groups, done } = this.groups(); const g = [...groups, un, done].find((g) => g.key === f.key); if (!g || g.notes.length < 2) return;
    this.goNote(g.notes[wrap(g.notes.findIndex((n) => n.id === f.noteId) + dir, g.notes.length)].id, g.key);
  }
  quickAddHere() {
    const f = this.state.focus; const { view } = this.state; const draft = emptyDraft();
    if (f) {
      const k = f.key;
      if (view === 'category' && catOf(k)) draft.category = k as Category;
      else if (view === 'project' && projOf(this.state.projects, k)) draft.project = k;
      else if (view === 'priority' && /^P[123]$/.test(k)) draft.priority = +k[1] as Priority;
      if (f.type === 'note') { this.focusCluster(k); setTimeout(() => this.setState({ adding: true, draft }), 450); return; }
    }
    this.setState({ adding: true, draft });
  }
  dive() {
    const f = this.state.focus;
    if (!f) { const real = this.placed().filter((p) => !p.collapsed && !p.g.ghost); const first = real.find((p) => !p.g.rail) || real[0]; if (first) this.focusCluster(first.g.key); return; }
    if (f.type === 'cluster') { const { un, groups, done } = this.groups(); const g = [...groups, un, done].find((g) => g.key === f.key); if (g && g.notes.length) this.goNote(g.notes[0].id, g.key); }
  }
  back() { const f = this.state.focus; this.pinch = null; if (f && f.type === 'note') this.focusCluster(f.key); else this.overview(); }
  /** Mobile flick → the same moves as the arrow keys / Tab. dx<0 is a flick to the left, dy<0 a flick up. */
  onFlick(dx: number, dy: number) {
    const f = this.state.focus;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (f) { this.step(dx < 0 ? 1 : -1); return; }
      const i = VIEWS.findIndex((v) => v.id === this.state.view); this.setView(VIEWS[(i + (dx < 0 ? 1 : -1) + VIEWS.length) % VIEWS.length].id);
    }
    // Vertical flicks are intentionally unmapped: pinch out dives in, pinch in steps back (see panMove).
  }
  /** Mobile pinch-out: focus whatever sits under the pinch midpoint (area in overview, note inside an area). */
  diveAt(mid: { x: number; y: number }) {
    const f = this.state.focus;
    if (!f) {
      const s = this.state; const wx = (mid.x - s.pan.x) / s.zoom, wy = (mid.y - s.pan.y) / s.zoom;
      const cands = this.placed().filter((p) => !p.collapsed && !p.g.ghost);
      const hit = cands.find((p) => wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h)
        ?? cands.sort((a, b) => Math.hypot(a.x + a.w / 2 - wx, a.y + a.h / 2 - wy) - Math.hypot(b.x + b.w / 2 - wx, b.y + b.h / 2 - wy))[0];
      if (hit) this.focusCluster(hit.g.key);
      return;
    }
    if (f.type !== 'cluster') return;
    const tiles = [...(this.rootRef.current?.querySelectorAll<HTMLElement>(`[data-key="${f.key}"] [data-note-id]`) ?? [])];
    const dist = (r: DOMRect) => Math.hypot(Math.max(r.left - mid.x, 0, mid.x - r.right), Math.max(r.top - mid.y, 0, mid.y - r.bottom));
    const best = tiles.map((el) => ({ el, d: dist(el.getBoundingClientRect()) })).sort((a, b) => a.d - b.d)[0];
    if (best) this.goNote(best.el.dataset.noteId!, f.key); else this.dive();
  }
  /** Glide back to the fitted framing of the current level (after an undecided pinch on mobile). */
  refit() {
    const f = this.state.focus;
    if (!f) this.overview(); else if (f.type === 'cluster') this.focusCluster(f.key); else this.goNote(f.noteId, f.key);
  }

  // ---------- notes ----------
  updateNote(id: string, patch: Partial<Note>) {
    const notes = this.state.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)); this.setState({ notes });
    const n = notes.find((x) => x.id === id); if (n) this.sync.upsert(n);
  }
  toggleDone(id: string) { const n = this.state.notes.find((n) => n.id === id); if (!n) return; this.updateNote(id, { done: !n.done }); this.setState({ flash: id }); this.toast(!n.done ? 'Moved to Done' : 'Back on the canvas'); }
  toast(text: string, ms = 2200) { clearTimeout(this.tt); this.setState({ toast: text }); this.tt = setTimeout(() => this.setState({ toast: null }), ms); }
  submit() {
    const d = this.state.draft; const text = d.text.trim(); if (!text) return; const r = routeDraft({ ...d, text }, this.state.projects);
    const note: Note = { id: uid(), text, category: r.category, project: r.project, priority: r.priority, done: false, comments: [], createdAt: new Date().toISOString() };
    const notes = [...this.state.notes, note];
    const target = this.state.view === 'category' ? catOf(r.category) : this.state.view === 'project' ? projOf(this.state.projects, r.project) : r.priority ? PRIOS[r.priority - 1] : null;
    this.setState({ notes, adding: false, draft: emptyDraft(), flash: note.id }); this.sync.upsert(note);
    this.toast(target ? (r.auto ? 'Auto-routed to ' : 'Dropped in ') + target.label : 'Dropped in Unsorted');
  }
  openCalendar(n: Note, start?: Date, minutes?: number) {
    const w = window.open(gcalUrl(n, { start, minutes, origin: this.props.origin }), '_blank', 'noopener');
    if (w) this.toast('Opened in Google Calendar');
  }

  // ---------- render helpers ----------
  chips(list: Dim[], dim: 'category' | 'project' | 'priority', current: string | number | null, set: (v: string | number | null) => void, big?: boolean) {
    return list.map((o) => {
      const val = dim === 'priority' ? (o.n as number) : o.id; const on = current === val; const hue = dim === 'category' && on ? o.hue! : null;
      return (
        <button key={o.id} type="button" className="bv-chip" onClick={(e) => { e.stopPropagation(); set(on ? null : val); }}
          style={{ display: 'flex', alignItems: 'center', gap: big ? 7 : 6, fontSize: big ? 12.5 : 12, padding: big ? '6px 11px 6px 9px' : '0 10px 0 8px', height: big ? undefined : 30, minHeight: 30, borderRadius: 999, border: `1px solid ${on ? 'transparent' : 'rgba(255,255,255,.14)'}`, background: on ? (hue != null ? `oklch(85% 0.12 ${hue})` : 'rgba(255,255,255,.9)') : 'rgba(255,255,255,.06)', color: on ? '#120a1f' : '#cfc7dd', cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap' }}>
          <Icon name={o.icon} size={13} color={on ? '#120a1f' : '#cfc7dd'} />{o.label}
        </button>
      );
    });
  }
  /** Project chips plus a trailing "+" that opens the project editor, so a project can be made mid-thought. */
  projectChips(current: string | null, set: (v: string | number | null) => void, big?: boolean) {
    const { projects } = this.state;
    const plus = (
      <button key="_add" type="button" className="bv-chip" title="New project" onClick={(e) => { e.stopPropagation(); this.openProjectEditor(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: big ? 12.5 : 12, padding: big ? '6px 11px 6px 9px' : '0 10px 0 8px', height: big ? undefined : 30, minHeight: 30, borderRadius: 999, border: '1px dashed rgba(255,255,255,.22)', background: 'transparent', color: 'rgba(207,199,221,.8)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <Icon name="add-01" size={13} color="currentColor" />{projects.length ? 'New' : 'First project'}
      </button>
    );
    return [...this.chips(projects, 'project', current, set, big), plus];
  }
  roundBtn(props: { onClick: (e: React.MouseEvent) => void; title: string; size?: number; children: React.ReactNode; fontSize?: number }) {
    return (
      <button type="button" data-nopan="1" className="bv-round" onClick={props.onClick} title={props.title}
        style={{ width: props.size ?? 24, height: props.size ?? 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.7)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, fontSize: props.fontSize ?? 13, lineHeight: 1, flex: 'none' }}>
        {props.children}
      </button>
    );
  }
  label(text: string, extra?: React.CSSProperties) { return <span style={{ fontFamily: OX, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(236,230,245,.4)', ...extra }}>{text}</span>; }

  renderCluster(p: Placed) {
    const s = this.state; const { g, x, y, w, h, collapsed } = p; const { view, flash, focus } = s; const { mobile } = this.lp(s);
    const other = view === 'category' ? 'project' : view === 'project' ? 'category' : null;
    const isF = !!focus && focus.key === g.key; const dim = !!focus && !isF; const noteF = isF && focus!.type === 'note';
    const glyph = collapsed ? (mobile ? '▾' : g.key === '_un' ? '›' : '‹') : mobile ? '▴' : g.key === '_un' ? '‹' : '›';
    const toggle = (e: React.MouseEvent) => { e.stopPropagation(); const rails = { ...s.rails, [g.key]: !collapsed } as Rails; if (focus) this.setState({ rails }); else this.overview({ rails }); this.setRails(rails); };
    const onClick = (e: React.MouseEvent) => { if (this.moved || (e.target as HTMLElement).closest('[data-nopan]')) return; if (collapsed) { toggle(e); return; } if (isF && focus!.type === 'cluster') return; this.focusCluster(g.key); };
    if (g.ghost) {
      const first = !s.projects.length;
      return (
        <div key={g.key} data-cluster="1" data-key={g.key} data-collapsed="0" data-nopan="1" className="bv-cluster" onClick={(e) => { e.stopPropagation(); if (!this.moved) this.openProjectEditor(); }}
          style={{ position: 'absolute', left: 0, top: 0, width: w, transform: `translate(${x}px, ${y}px)`, transition: 'transform .8s cubic-bezier(.2,.8,.2,1), opacity .45s', opacity: dim ? 0 : 1, pointerEvents: dim ? 'none' : 'auto', cursor: 'pointer', padding: first ? '30px 20px 28px' : '18px 16px 16px', borderRadius: 22, border: '1px dashed rgba(255,255,255,.18)', background: 'rgba(255,255,255,.015)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <Icon name="add-01" size={first ? 30 : 24} color="#c9b8ff" style={{ opacity: 0.9 }} />
          <div style={{ fontFamily: OX, fontWeight: 700, fontSize: first ? 17 : 14, letterSpacing: '.02em', color: '#f3eefc' }}>{g.label}</div>
          {first && <div style={{ fontSize: 13, lineHeight: 1.45, color: 'rgba(236,230,245,.5)', maxWidth: 260 }}>Projects are yours to name: a trip, a side thing, a client, a house move. Notes that mention the name find their way here on their own.</div>}
          <button type="button" className="bv-primary" onClick={(e) => { e.stopPropagation(); this.openProjectEditor(); }}
            style={{ marginTop: first ? 6 : 0, fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#c9b8ff,#7f5cf0)', color: '#120a1f', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 24px rgba(169,140,255,.3)' }}>{first ? 'Create a project' : 'Add'}</button>
        </div>
      );
    }
    const editable = view === 'project' && !g.rail;
    return (
      <div key={g.key} data-cluster="1" data-key={g.key} data-collapsed={collapsed ? '1' : '0'} className="bv-cluster" onClick={onClick}
        style={{ position: 'absolute', left: 0, top: 0, width: w, minHeight: collapsed ? h : 0, transform: `translate(${x}px, ${y}px)`, transition: 'transform .8s cubic-bezier(.2,.8,.2,1), opacity .45s, width .5s, background .4s', opacity: dim ? 0 : 1, pointerEvents: dim ? 'none' : 'auto', cursor: isF ? 'default' : 'pointer', padding: collapsed ? (mobile ? '12px 16px' : '16px 12px') : '18px 16px 16px', borderRadius: 22, border: '1px solid rgba(255,255,255,.08)', background: isF ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.028)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)' }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: mobile ? 'row' : 'column', alignItems: 'center', gap: 14, height: '100%' }}>
            <Icon name={g.icon} size={20} style={{ opacity: 0.95 }} />
            <div style={{ fontFamily: OX, fontWeight: 700, fontSize: 11, letterSpacing: '.04em', color: 'rgba(243,238,252,.8)', writingMode: mobile ? 'horizontal-tb' : 'vertical-rl' }}>{g.label}</div>
            <div style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.1em', color: 'rgba(236,230,245,.4)', marginLeft: mobile ? 'auto' : 0 }}>{String(g.notes.length).padStart(2, '0')}</div>
            {this.roundBtn({ onClick: toggle, title: 'Expand', children: glyph })}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Icon name={g.icon} size={28} style={{ opacity: 0.95 }} />
                <div style={{ fontFamily: OX, fontWeight: 700, fontSize: 18, letterSpacing: '.02em', color: '#f3eefc', textShadow: '0 0 16px rgba(243,238,252,.35)' }}>{g.label}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.1em', color: 'rgba(236,230,245,.4)' }}>{String(g.notes.length).padStart(2, '0')}</div>
                {editable && this.roundBtn({ onClick: (e) => { e.stopPropagation(); this.openProjectEditor(g.key); }, title: 'Edit project', children: <Icon name="edit-02" size={12} color="currentColor" /> })}
                {g.rail && this.roundBtn({ onClick: toggle, title: 'Collapse', children: glyph })}
              </div>
            </div>
            {g.notes.length === 0 && <div style={{ fontSize: 13, color: 'rgba(236,230,245,.32)', padding: '10px 4px 6px', fontStyle: 'italic' }}>Nothing here yet</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {g.notes.map((n) => {
                const icons: { name: IconName; title: string }[] = [];
                const add = (list: Dim[], id: string | null) => { const d = list.find((x) => x.id === id); if (d) icons.push({ name: d.icon, title: d.label }); };
                if (other === 'project' || view === 'priority') add(s.projects, n.project);
                if (other === 'category' || view === 'priority') add(CATS, n.category);
                if (view !== 'priority' && n.priority) add(PRIOS, 'P' + n.priority);
                const cat = catOf(n.category); const hue = cat ? cat.hue : null; const isN = noteF && focus!.type === 'note' && focus!.noteId === n.id; const cm = n.comments.length;
                return (
                  <div key={n.id} data-nopan="1" data-note-id={n.id} className="bv-note"
                    onClick={(e) => { e.stopPropagation(); if (this.moved || isN) return; this.focusNote(n.id, g.key, e.currentTarget.getBoundingClientRect()); }}
                    style={{ flex: '1 1 calc(50% - 5px)', minWidth: 130, maxWidth: '100%', position: 'relative', padding: '12px 12px 10px', borderRadius: 14, background: hue != null ? `oklch(${n.done ? '78%' : '85%'} 0.12 ${hue})` : n.done ? '#cfc7dd' : '#ece6f5', border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.25)', cursor: 'pointer', animation: flash === n.id ? 'bv-flash 1.2s ease-out' : 'none', opacity: noteF && !isN ? 0.18 : n.done ? 0.6 : 1, transition: 'opacity .4s, background .3s' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.35, color: '#120a1f', fontWeight: 500, textWrap: 'pretty', paddingRight: 22, textDecoration: n.done ? 'line-through' : 'none', whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', minHeight: 14 }}>
                      {icons.map((ic, i) => <Icon key={i} name={ic.name} size={14} color="#120a1f" style={{ opacity: 0.75 }} title={ic.title} />)}
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(18,10,31,.7)' }}>
                        {cm > 0 && <><Icon name="comment-01" size={13} color="#120a1f" style={{ opacity: 0.75 }} /><span>{cm}</span></>}
                        <button type="button" className="bv-tileact" title="Plan in Google Calendar" onClick={(e) => { e.stopPropagation(); this.openCalendar(n); }}
                          style={{ width: 20, height: 20, margin: '-3px -4px -3px 0', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, transition: 'opacity .2s, background .2s' }}>
                          <Icon name="calendar-add-01" size={14} color="#120a1f" />
                        </button>
                      </div>
                    </div>
                    <button type="button" className="bv-check" onClick={(e) => { e.stopPropagation(); this.toggleDone(n.id); }} title={n.done ? 'Reopen' : 'Mark done'}
                      style={{ position: 'absolute', top: 9, right: 9, width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${n.done ? '#120a1f' : 'rgba(18,10,31,.4)'}`, background: n.done ? '#120a1f' : 'transparent', color: '#f3eefc', fontSize: 11, lineHeight: 1, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>{n.done ? '✓' : ''}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  renderPanel(en: Note) {
    const s = this.state; const f = s.focus!; const { mobile } = this.lp(s);
    const cms = en.comments; const ci = clamp(s.cIdx, 0, Math.max(0, cms.length - 1)); const cat = catOf(en.category); const hue = cat ? cat.hue : null;
    const setN = (dim: 'category' | 'project' | 'priority') => (val: string | number | null) => this.updateNote(en.id, { [dim]: val } as Partial<Note>);
    const addComment = () => { const t = s.commentDraft.trim(); if (!t) return; const comments = [...cms, { id: uid(), text: t, at: new Date().toISOString() }]; this.updateNote(en.id, { comments }); this.setState({ commentDraft: '', cIdx: comments.length - 1 }); };
    const pos: React.CSSProperties = mobile ? { left: 10, right: 10, bottom: 10, maxHeight: '58vh' } : s.vw >= 900 ? { right: 24, top: '50%', transform: 'translateY(-50%)', width: 380, maxHeight: 'calc(100vh - 48px)' } : { left: '50%', bottom: 16, transform: 'translateX(-50%)', width: 'min(480px, calc(100vw - 32px))', maxHeight: '52vh' };
    const pillBtn = (cls: string, extra: React.CSSProperties): React.CSSProperties => ({ fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, cursor: 'pointer', ...extra });
    const planStart = () => { const d = new Date(`${s.plan.date}T${s.plan.time || '09:00'}:00`); return isNaN(d.getTime()) ? undefined : d; };
    const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#f3eefc', fontSize: 13, outline: 'none', minWidth: 0 };
    return (
      <div data-nopan="1" data-ui="1" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', ...pos, overflow: 'auto', borderRadius: 24, padding: '20px 20px 16px', background: hue != null ? `linear-gradient(180deg, oklch(80% 0.13 ${hue} / 0.14), rgba(255,255,255,.07))` : 'rgba(255,255,255,.09)', border: `1px solid ${tint(hue, 0.35)}`, backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: `${s.vw >= 900 && !mobile ? 'bv-pop' : 'bv-pop'} .25s ease-out`, display: 'flex', flexDirection: 'column', gap: 14, cursor: 'default' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: OX, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#c9b8ff' }}>Note</div>
          {this.roundBtn({ onClick: () => this.back(), title: 'Back to area', size: 28, fontSize: 14, children: '×' })}
        </div>
        <textarea className="bv-ta" value={en.text} onChange={(e) => this.updateNote(en.id, { text: e.target.value })} rows={3} style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: '#f3eefc', fontSize: 18, lineHeight: 1.35, padding: 0, caretColor: '#c9b8ff' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', columnGap: 12, rowGap: 12, alignItems: 'start', paddingTop: 4 }}>
          {this.label('Life', { paddingTop: 9 })}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{this.chips(CATS, 'category', en.category, setN('category'))}</div>
          {this.label('Project', { paddingTop: 9 })}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{this.projectChips(en.project, setN('project'))}</div>
          {this.label('Priority', { paddingTop: 9 })}<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{this.chips(PRIOS, 'priority', en.priority, setN('priority'))}</div>
        </div>
        {/* Plan: opens Google Calendar with the note prefilled; saving happens over there. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="calendar-add-01" size={13} color="rgba(236,230,245,.55)" />{this.label('Plan on Google Calendar')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
            <input className="bv-input" type="date" value={s.plan.date} onChange={(e) => this.setState({ plan: { ...s.plan, date: e.target.value } })} style={inputStyle} aria-label="Date" />
            <input className="bv-input" type="time" step={300} value={s.plan.time} onChange={(e) => this.setState({ plan: { ...s.plan, time: e.target.value } })} style={inputStyle} aria-label="Time" />
            <select className="bv-input" value={s.plan.minutes} onChange={(e) => this.setState({ plan: { ...s.plan, minutes: +e.target.value } })} style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 10 }} aria-label="Duration">
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m} style={{ color: '#120a1f' }}>{m < 60 ? m + ' min' : m / 60 + ' h'}</option>)}
            </select>
          </div>
          <button type="button" className="bv-pill" onClick={() => this.openCalendar(en, planStart(), s.plan.minutes)}
            style={{ ...pillBtn('', { border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.75)' }), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Add to calendar <Icon name="arrow-up-right-01" size={12} color="currentColor" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.1)' }}>
          {this.label('Comments · ' + cms.length)}
          {cms.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
              <button type="button" className="bv-round" onClick={() => this.setState({ cIdx: (ci - 1 + cms.length) % cms.length })} style={{ width: 30, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(236,230,245,.7)', cursor: 'pointer', fontSize: 16, padding: 0, flex: 'none' }}>‹</button>
              <div style={{ flex: 1, minWidth: 0, position: 'relative', padding: '12px 36px 12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" className="bv-ghost" title="Delete comment" onClick={() => { const comments = cms.filter((_, i) => i !== ci); this.updateNote(en.id, { comments }); this.setState({ cIdx: Math.max(0, ci - 1) }); }}
                  style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: 0.55 }}><Icon name="delete-02" size={14} /></button>
                <div style={{ fontSize: 14, lineHeight: 1.4, color: '#f3eefc', textWrap: 'pretty' }}>{cms[ci].text}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(236,230,245,.4)' }}><span>{stamp(cms[ci].at)}</span><span>{ci + 1} / {cms.length}</span></div>
              </div>
              <button type="button" className="bv-round" onClick={() => this.setState({ cIdx: (ci + 1) % cms.length })} style={{ width: 30, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: 'rgba(236,230,245,.7)', cursor: 'pointer', fontSize: 16, padding: 0, flex: 'none' }}>›</button>
            </div>
          )}
          <input className="bv-input" value={s.commentDraft} onChange={(e) => this.setState({ commentDraft: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addComment(); } }} placeholder="Add a comment, Enter to save"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#f3eefc', fontSize: 13.5, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 2 }}>
          <button type="button" className="bv-danger" onClick={() => { const notes = s.notes.filter((n) => n.id !== en.id); this.setState({ notes }); this.sync.remove(en.id); this.focusCluster(f.key); this.toast('Note deleted'); }}
            style={pillBtn('', { border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.75)' })}>Delete note</button>
          <button type="button" className="bv-white" onClick={() => this.toggleDone(en.id)} style={pillBtn('', { border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.92)', color: '#120a1f', fontWeight: 700 })}>{en.done ? 'Reopen' : 'Mark done'}</button>
        </div>
      </div>
    );
  }

  renderAdd() {
    const s = this.state; const d = s.draft; const { mobile } = this.lp(s);
    const setD = (dim: 'category' | 'project' | 'priority') => (val: string | number | null) => this.setState({ draft: { ...this.state.draft, [dim]: val } });
    const routed = routeDraft(d, s.projects); const rt = routed.auto ? (routed.category ? catOf(routed.category) : projOf(s.projects, routed.project)) : null;
    const routeHint = !d.text.trim() ? 'Tags optional, it finds its own cluster' : rt ? 'Looks like ' + rt.label + ', will route there' : d.category || d.project || d.priority ? 'Ready to drop' : 'No match yet, lands in Unsorted';
    const row = (lbl: string, chips: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{this.label(lbl, { width: 64 })}{chips}</div>
    );
    return (
      <div data-nopan="1" data-ui="1" onClick={() => this.setState({ adding: false })} onPointerDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', inset: 0, background: 'rgba(8,4,16,.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? '0 10px 10px' : 24, cursor: 'default' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, borderRadius: 24, padding: '22px 22px 18px', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', animation: 'bv-pop .25s ease-out', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: OX, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#c9b8ff' }}>Brain dump</div>
            <div style={{ fontSize: 11, color: 'rgba(236,230,245,.4)' }}>Enter to add · Esc to close</div>
          </div>
          <textarea className="bv-ta" autoFocus value={d.text} onChange={(e) => this.setState({ draft: { ...this.state.draft, text: e.target.value } })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.submit(); } }} placeholder="What's on your mind?" rows={3}
            style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: '#f3eefc', fontSize: 20, lineHeight: 1.35, padding: '2px 0', caretColor: '#c9b8ff' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {row('Life', this.chips(CATS, 'category', d.category, setD('category'), true))}
            {row('Project', this.projectChips(d.project, setD('project'), true))}
            {row('Priority', this.chips(PRIOS, 'priority', d.priority, setD('priority'), true))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 4 }}>
            <div style={{ fontSize: 12, color: 'rgba(236,230,245,.45)' }}>{routeHint}</div>
            <button type="button" className="bv-primary" onClick={() => this.submit()} style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '12px 20px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg,#c9b8ff,#7f5cf0)', color: '#120a1f', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 24px rgba(169,140,255,.4)', opacity: d.text.trim() ? 1 : 0.45 }}>Drop it</button>
          </div>
        </div>
      </div>
    );
  }

  renderMenu() {
    const s = this.state; const a = this.props.initial.account;
    const item = (label: string, onClick: () => void, opts?: { icon?: IconName; danger?: boolean; href?: string }) => {
      const st: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', color: opts?.danger ? '#ff9a9a' : 'rgba(236,230,245,.85)', fontSize: 13.5, textAlign: 'left', cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' };
      const inner = <>{opts?.icon && <Icon name={opts.icon} size={15} color="currentColor" style={{ opacity: 0.8 }} />}{label}</>;
      return opts?.href
        ? <a key={label} className="bv-ghost" href={opts.href} onClick={onClick} style={{ ...st, opacity: 1 }}>{inner}</a>
        : <button key={label} type="button" className="bv-ghost" onClick={onClick} style={{ ...st, opacity: 1 }}>{inner}</button>;
    };
    return (
      <div data-nopan="1" data-ui="1" onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', right: 0, top: 42, width: 260, padding: 8, borderRadius: 18, background: 'rgba(28,17,48,.92)', border: '1px solid rgba(255,255,255,.14)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', animation: 'bv-pop .2s ease-out', display: 'flex', flexDirection: 'column', gap: 2, cursor: 'default' }}>
        <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', marginBottom: 4 }}>
          {a.name && <div style={{ fontSize: 13.5, color: '#f3eefc', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>}
          <div style={{ fontSize: 12, color: 'rgba(236,230,245,.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.4, color: 'rgba(201,184,255,.75)' }}>Beta. Export your notes now and then; a copy on your own disk beats trusting one database.</div>
        </div>
        {item('Export my notes', () => this.setState({ menu: false }), { icon: 'download-04', href: '/api/export' })}
        {item('Privacy', () => this.setState({ menu: false }), { icon: 'shield-01', href: '/privacy' })}
        {item('Sign out', () => this.signOutNow(), { icon: 'logout-03' })}
        <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '4px 6px' }} />
        {item(s.busy ? 'Deleting…' : 'Delete my account', () => this.deleteAccountNow(), { icon: 'delete-02', danger: true })}
      </div>
    );
  }

  renderProjectEditor(e: ProjEdit) {
    const { mobile } = this.lp(this.state); const editing = !!e.id; const ok = !!e.label.trim();
    const pill = (extra: React.CSSProperties): React.CSSProperties => ({ fontFamily: OX, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', padding: '11px 18px', borderRadius: 999, cursor: 'pointer', ...extra });
    return (
      <div data-nopan="1" data-ui="1" onClick={() => this.setState({ projEdit: null })} onPointerDown={(ev) => ev.stopPropagation()}
        style={{ position: 'absolute', inset: 0, background: 'rgba(8,4,16,.62)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', padding: mobile ? '0 10px 10px' : 24, cursor: 'default' }}>
        <div onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); this.saveProject(); } }} style={{ width: '100%', maxWidth: 440, borderRadius: 24, padding: '22px 22px 18px', background: 'rgba(255,255,255,.09)', border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', animation: 'bv-pop .25s ease-out', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: OX, fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: '#c9b8ff' }}>{editing ? 'Edit project' : 'New project'}</div>
            <div style={{ fontSize: 11, color: 'rgba(236,230,245,.4)' }}>Enter to save · Esc to close</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', flex: 'none' }}><Icon name={e.icon} size={22} /></div>
            <input className="bv-input" autoFocus value={e.label} maxLength={MAX_PROJECT_LABEL} placeholder="Name it: Japan trip, the book, kitchen…"
              onChange={(ev) => this.setState({ projEdit: { ...e, label: ev.target.value } })}
              style={{ flex: 1, minWidth: 0, padding: '11px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: '#f3eefc', fontSize: 16, outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
            {PROJECT_ICONS.map((ic) => { const on = ic === e.icon; return (
              <button key={ic} type="button" className="bv-chip" onMouseDown={(ev) => ev.preventDefault()} onClick={() => this.setState({ projEdit: { ...e, icon: ic } })} title={ic}
                style={{ aspectRatio: '1', borderRadius: 12, border: `1px solid ${on ? 'transparent' : 'rgba(255,255,255,.12)'}`, background: on ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.05)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, transition: 'all .15s' }}>
                <Icon name={ic} size={18} color={on ? '#120a1f' : '#cfc7dd'} />
              </button>
            ); })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            {editing
              ? <button type="button" className="bv-danger" onClick={() => this.deleteProject(e.id!)} style={pill({ border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.05)', color: 'rgba(236,230,245,.75)' })}>Remove</button>
              : <div style={{ fontSize: 12, color: 'rgba(236,230,245,.45)' }}>Notes that mention the name route here</div>}
            <button type="button" className="bv-primary" onClick={() => this.saveProject()} style={{ ...pill({ border: 'none', background: 'linear-gradient(135deg,#c9b8ff,#7f5cf0)', color: '#120a1f', fontWeight: 700, boxShadow: '0 0 24px rgba(169,140,255,.4)' }), opacity: ok ? 1 : 0.45 }}>{editing ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- pointer handling (pan + pinch) ----------
  panStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Flick candidate (mobile only): recorded before the nopan check so a swipe may start on a tile or cluster, but never inside UI chrome.
    if (this.lp(this.state).mobile) this.flick = this.flick || this.pointers.size || this.state.adding || (e.target as HTMLElement).closest('[data-ui]') ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
    // Desktop: tiles/chrome never pan. Mobile: only UI chrome is excluded, so a pinch may start on tiles or clusters.
    const t = e.target as HTMLElement;
    if (t.closest('[data-ui]') || (!this.lp(this.state).mobile && t.closest('[data-nopan]'))) return;
    const s = this.state; this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.moved = false;
    if (this.pointers.size === 2) {
      for (const id of this.pointers.keys()) { try { e.currentTarget.setPointerCapture(id); } catch { /* ignore */ } }
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: s.zoom, p0: s.pan }; this.drag = null;
    } else { this.drag = { sx: e.clientX, sy: e.clientY, px: s.pan.x, py: s.pan.y }; e.currentTarget.style.cursor = 'grabbing'; }
  };
  panMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!this.pointers.has(e.pointerId)) return; this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; this.moved = true;
      if (Date.now() < this.cool) return; const nz = clamp((this.pinch.z0 * dist) / this.pinch.d0, 0.3, 3.4);
      if (this.lp(this.state).mobile) {
        // Mobile: the pinch *is* the focus control. Spread → dive into what is under the fingers, squeeze → step back out.
        const ratio = dist / this.pinch.d0;
        if (ratio >= 1.35 && (!this.state.focus || this.state.focus.type === 'cluster')) { this.pinch = null; this.pinchActed = true; this.diveAt(mid); return; }
        if (ratio <= 0.7 && this.state.focus) { this.pinch = null; this.pinchActed = true; this.back(); return; }
      } else if (this.state.focus && nz < this.state.focusZoom * 0.8) { this.pinch = null; this.back(); return; }
      const k = nz / this.pinch.z0; this.setState({ zoom: nz, glide: false, pan: { x: mid.x - (this.pinch.mid0.x - this.pinch.p0.x) * k, y: mid.y - (this.pinch.mid0.y - this.pinch.p0.y) * k } }); return;
    }
    if (!this.drag) return; const dx = e.clientX - this.drag.sx, dy = e.clientY - this.drag.sy;
    if (!this.moved && Math.abs(dx) + Math.abs(dy) > 4) { this.moved = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    if (this.moved) this.setState({ glide: false, pan: { x: this.drag.px + dx, y: this.drag.py + dy } });
  };
  panEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) {
      // Mobile pinch that ended without crossing a threshold: settle back onto the current level's framing.
      if (this.pinch && this.lp(this.state).mobile && !this.pinchActed) this.refit();
      this.pinch = null; this.pinchActed = false;
    }
    if (this.pointers.size === 0) this.drag = null;
    const fl = this.flick; if (fl && fl.id === e.pointerId) {
      this.flick = null; const dx = e.clientX - fl.x, dy = e.clientY - fl.y, ax = Math.abs(dx), ay = Math.abs(dy);
      if (e.type === 'pointerup' && !this.state.adding && this.pointers.size === 0 && Date.now() - fl.t <= 350 && Math.hypot(dx, dy) >= 50 && Math.max(ax, ay) >= 1.5 * Math.min(ax, ay)) { this.moved = true; this.onFlick(dx, dy); }
    }
    e.currentTarget.style.cursor = 'grab'; setTimeout(() => { this.moved = false; }, 0);
  };

  render() {
    const s = this.state; const { mobile } = this.lp(s); const f = s.focus;
    const en = f && f.type === 'note' ? s.notes.find((n) => n.id === f.noteId) : null;
    const open = s.notes.filter((n) => !n.done).length, done = s.notes.length - open;
    const syncLabel = s.sync === 'offline' ? 'NOT SAVED' : s.sync === 'saving' ? 'SAVING' : null;
    const syncTitle = s.sync === 'offline' ? 'Could not reach the server, retrying' : s.sync === 'saving' ? 'Saving…' : 'All changes saved';
    return (
      <div ref={this.rootRef} style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)', overflow: 'hidden', touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
        onClick={(e) => { if (s.menu && !(e.target as HTMLElement).closest('[data-menu]')) this.setState({ menu: false }); if (this.moved || !f || s.adding || (e.target as HTMLElement).closest('[data-nopan]') || (e.target as HTMLElement).closest('[data-cluster]')) return; this.back(); }}
        onPointerDown={this.panStart} onPointerMove={this.panMove} onPointerUp={this.panEnd} onPointerCancel={this.panEnd}>
        <Sky panX={s.pan.x} panY={s.pan.y} vw={s.vw} vh={s.vh} drifters={s.drifters} />
        <div ref={this.worldRef} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${s.pan.x}px, ${s.pan.y}px) scale(${s.zoom})`, transition: s.glide ? 'transform .85s cubic-bezier(.2,.8,.2,1)' : 'none', willChange: 'transform', opacity: s.ready ? 1 : 0 }}>
          {s.ready && this.placed().map((p) => this.renderCluster(p))}
        </div>

        <div data-nopan="1" data-ui="1" style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: mobile ? '14px 14px' : '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(18,10,31,.92) 0%, rgba(18,10,31,.6) 65%, rgba(18,10,31,0) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto', minWidth: 0 }}>
            <div style={{ fontFamily: OX, fontWeight: 700, fontSize: mobile ? 12 : 16, letterSpacing: mobile ? '.18em' : '.28em', color: '#f3eefc', textShadow: '0 0 18px rgba(201,184,255,.55)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>BRAINVERSE</div>
            {f && <button type="button" className="bv-pill" onClick={() => this.back()} style={{ fontFamily: OX, fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase', padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.06)', color: 'rgba(236,230,245,.75)', cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', whiteSpace: 'nowrap' }}>{f.type === 'note' ? '← Area' : '← Overview'}</button>}
            <div title={syncTitle} style={{ fontFamily: OX, fontSize: 10, letterSpacing: '.14em', color: 'rgba(236,230,245,.4)', display: mobile || f ? 'none' : 'block', whiteSpace: 'nowrap' }}>
              {open} OPEN · {done} DONE{syncLabel && <span style={{ color: s.sync === 'offline' ? '#ff9a9a' : s.sync === 'saving' ? '#c9b8ff' : 'rgba(236,230,245,.4)' }}> · {syncLabel}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', flex: 'none' }}>
            <div style={{ display: 'flex', gap: mobile ? 2 : 4, padding: mobile ? 3 : 4, borderRadius: 999, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
              {VIEWS.map((v) => { const on = s.view === v.id; return (
                <button key={v.id} type="button" className="bv-tab" onClick={() => this.setView(v.id)} style={{ fontFamily: OX, fontSize: mobile ? 8.5 : 10, letterSpacing: mobile ? '.1em' : '.16em', textTransform: 'uppercase', padding: mobile ? '8px 8px' : '9px 14px', borderRadius: 999, border: `1px solid ${on ? 'rgba(255,255,255,.3)' : 'transparent'}`, background: on ? 'rgba(255,255,255,.14)' : 'transparent', color: on ? '#f3eefc' : 'rgba(236,230,245,.55)', cursor: 'pointer', transition: 'all .25s', minHeight: 34 }}>{v.label}</button>
              ); })}
            </div>
            <div data-menu="1" style={{ position: 'relative' }}>
              {this.roundBtn({ onClick: (e) => { e.stopPropagation(); this.setState({ menu: !s.menu }); }, title: 'Account', size: 34, children: <Icon name="user-circle" size={17} color="currentColor" /> })}
              {s.menu && this.renderMenu()}
            </div>
          </div>
        </div>

        {s.toast && <div style={{ position: 'absolute', left: '50%', bottom: mobile ? 104 : 112, transform: 'translateX(-50%)', padding: '10px 16px', borderRadius: 999, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', fontFamily: OX, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#f3eefc', animation: 'bv-pop .3s ease-out', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{s.toast}</div>}

        <button type="button" data-nopan="1" data-ui="1" className="bv-fab" onClick={(e) => { e.stopPropagation(); if (mobile && f) this.quickAddHere(); else this.setState({ adding: true }); }} title="Add a thought (N)"
          style={{ position: 'absolute', ...(mobile ? { left: '50%', bottom: 26, marginLeft: -30 } : { right: 32, bottom: 32 }), display: en && mobile ? 'none' : 'grid', width: 60, height: 60, borderRadius: '50%', border: '1px solid rgba(255,255,255,.3)', background: 'radial-gradient(circle at 30% 30%, #e6dcff 0%, #a98cff 45%, #6b45e6 100%)', color: '#120a1f', fontSize: 30, lineHeight: 1, fontWeight: 300, cursor: 'pointer', boxShadow: '0 0 34px rgba(169,140,255,.55), 0 10px 30px rgba(0,0,0,.4)', placeItems: 'center', padding: 0, transition: 'transform .2s' }}>+</button>

        {en && this.renderPanel(en)}
        {s.adding && this.renderAdd()}
        {s.projEdit && this.renderProjectEditor(s.projEdit)}
      </div>
    );
  }
}
