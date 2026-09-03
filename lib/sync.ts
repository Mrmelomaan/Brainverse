// Client-side write queue: optimistic local state first, server second.
// Each key keeps only its latest payload; failures stay queued and retry with backoff.
import type { Note, Prefs } from './model';

export type SyncStatus = 'local' | 'synced' | 'saving' | 'offline';
type Job = { url: string; method: 'PUT' | 'DELETE'; body?: unknown };

export class Sync {
  private jobs = new Map<string, Job>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private failures = 0;
  private listeners = new Set<(s: SyncStatus) => void>();
  private status: SyncStatus;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    this.status = enabled ? 'synced' : 'local';
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flush(0));
      window.addEventListener('beforeunload', () => { if (this.jobs.size) this.flushBeacon(); });
    }
  }
  onStatus(cb: (s: SyncStatus) => void) { this.listeners.add(cb); cb(this.status); return () => { this.listeners.delete(cb); }; }
  private set(s: SyncStatus) { if (s !== this.status) { this.status = s; this.listeners.forEach((l) => l(s)); } }

  upsert(note: Note) { this.jobs.delete('del:' + note.id); this.put('note:' + note.id, { url: '/api/notes', method: 'PUT', body: note }); }
  upsertMany(list: Note[]) { if (list.length) this.put('bulk:' + Date.now(), { url: '/api/notes', method: 'PUT', body: list }); }
  remove(id: string) { this.jobs.delete('note:' + id); this.put('del:' + id, { url: '/api/notes/' + encodeURIComponent(id), method: 'DELETE' }); }
  prefs(p: Prefs) { this.put('prefs', { url: '/api/prefs', method: 'PUT', body: p }); }

  private put(key: string, job: Job) {
    if (!this.enabled) return;
    this.jobs.set(key, job);
    this.set('saving');
    this.flush(350);
  }
  private flush(delay: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), delay);
  }
  private async run() {
    if (this.running || !this.enabled) return;
    this.running = true;
    try {
      while (this.jobs.size) {
        const [key, job] = this.jobs.entries().next().value as [string, Job];
        try {
          const res = await fetch(job.url, { method: job.method, headers: { 'content-type': 'application/json' }, body: job.body === undefined ? undefined : JSON.stringify(job.body), credentials: 'same-origin' });
          if (res.status === 401) { window.location.assign(window.location.origin + '/login'); return; }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          // Only drop the job if nothing newer replaced it while the request was in flight.
          if (this.jobs.get(key) === job) this.jobs.delete(key);
          this.failures = 0;
        } catch {
          this.failures++;
          this.set('offline');
          this.flush(Math.min(30_000, 1500 * 2 ** Math.min(this.failures, 4)));
          return;
        }
      }
      this.set('synced');
    } finally { this.running = false; }
  }
  private flushBeacon() {
    // Best effort on tab close: fold pending note writes into one beacon-able request is not possible
    // with PUT, so we rely on keepalive fetches instead.
    for (const job of this.jobs.values()) {
      try { fetch(job.url, { method: job.method, headers: { 'content-type': 'application/json' }, body: job.body === undefined ? undefined : JSON.stringify(job.body), keepalive: true }); } catch { /* ignore */ }
    }
  }
}
