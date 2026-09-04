import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { SEED, defaultPrefs, normaliseNote, type Note, type Prefs, type View } from '@/lib/model';
import { parsePrefs } from '@/lib/validate';

// Schema changes live in drizzle/ and are applied by hand from a laptop (`npm run db:migrate`).
// Nothing here creates or alters tables.

type DB = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __bvPool?: Pool; __bvDb?: DB };

function db(): DB {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!g.__bvDb) {
    g.__bvPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10_000 });
    g.__bvDb = drizzle(g.__bvPool, { schema });
  }
  return g.__bvDb;
}

const toNote = (r: typeof schema.notes.$inferSelect): Note =>
  normaliseNote({ id: r.id, text: r.text, category: r.category as Note['category'], project: r.project, priority: r.priority as Note['priority'], done: r.done, comments: r.comments, createdAt: r.createdAt.toISOString() });

const toPrefs = (p: typeof schema.prefs.$inferSelect | undefined): Prefs => {
  if (!p) return defaultPrefs();
  const view = (['category', 'project', 'priority'] as View[]).includes(p.view as View) ? (p.view as View) : 'category';
  return parsePrefs({ view, rails: p.rails, projects: p.projects }) ?? defaultPrefs();
};

// ---------- access ----------

export async function isAllowedEmail(email: string): Promise<boolean> {
  const rows = await db().select({ email: schema.allowedEmails.email }).from(schema.allowedEmails).where(eq(schema.allowedEmails.email, email.toLowerCase())).limit(1);
  return rows.length > 0;
}

/** Record (or refresh) an account that has been let in. */
export async function touchUser(u: { id: string; email: string; name?: string | null }) {
  await db().insert(schema.users).values({ id: u.id, email: u.email.toLowerCase(), name: u.name ?? null })
    .onConflictDoUpdate({ target: schema.users.id, set: { email: u.email.toLowerCase(), name: u.name ?? null, lastSeenAt: new Date() } });
}

/** Someone not on the list signed in: one row per Google account, counting attempts. */
export async function recordAccessRequest(u: { id: string; email: string; name?: string | null }) {
  await db().insert(schema.accessRequests).values({ sub: u.id, email: u.email.toLowerCase(), name: u.name ?? null })
    .onConflictDoUpdate({ target: schema.accessRequests.sub, set: { email: u.email.toLowerCase(), name: u.name ?? null, attempts: sql`${schema.accessRequests.attempts} + 1`, lastAt: new Date() } });
}

export async function clearAccessRequest(sub: string) {
  await db().delete(schema.accessRequests).where(eq(schema.accessRequests.sub, sub));
}

/** Delete-my-account: everything keyed on this account, plus its invite, in one transaction. */
export async function deleteAccount(sub: string, email: string) {
  await db().transaction(async (tx) => {
    await tx.delete(schema.notes).where(eq(schema.notes.owner, sub));
    await tx.delete(schema.prefs).where(eq(schema.prefs.owner, sub));
    await tx.delete(schema.accessRequests).where(eq(schema.accessRequests.sub, sub));
    await tx.delete(schema.allowedEmails).where(eq(schema.allowedEmails.email, email.toLowerCase()));
    await tx.delete(schema.users).where(eq(schema.users.id, sub));
  });
}

// ---------- universe ----------

export async function loadUniverse(owner: string): Promise<{ notes: Note[]; prefs: Prefs }> {
  const d = db();
  const rows = await d.select().from(schema.notes).where(eq(schema.notes.owner, owner)).orderBy(asc(schema.notes.createdAt), asc(schema.notes.id));
  const p = await d.select().from(schema.prefs).where(eq(schema.prefs.owner, owner)).limit(1);
  return { notes: rows.map(toNote), prefs: toPrefs(p[0]) };
}

/** First visit of an account (no prefs row yet): plant the tutorial notes once, then load as usual. */
export async function loadOrSeedUniverse(owner: string): Promise<{ notes: Note[]; prefs: Prefs }> {
  const d = db();
  const p = await d.select({ owner: schema.prefs.owner }).from(schema.prefs).where(eq(schema.prefs.owner, owner)).limit(1);
  if (!p.length) {
    const t0 = Date.now();
    const seeded: Note[] = SEED.map((n, i) => ({ ...n, id: crypto.randomUUID(), createdAt: new Date(t0 + i * 1000).toISOString() }));
    await d.transaction(async (tx) => {
      await tx.insert(schema.prefs).values({ owner, ...defaultPrefs(), updatedAt: new Date() }).onConflictDoNothing();
      await tx.insert(schema.notes).values(seeded.map((n) => ({ ...n, owner, createdAt: new Date(n.createdAt), updatedAt: new Date() }))).onConflictDoNothing();
    });
  }
  return loadUniverse(owner);
}

export async function upsertNotes(owner: string, list: Note[]) {
  if (!list.length) return;
  const values = list.map((n) => ({ id: n.id, owner, text: n.text, category: n.category, project: n.project, priority: n.priority, done: n.done, comments: n.comments, createdAt: new Date(n.createdAt), updatedAt: new Date() }));
  // Rows are scoped by owner: an id that belongs to another owner is never touched.
  await db().insert(schema.notes).values(values).onConflictDoUpdate({
    target: schema.notes.id,
    set: { text: sql`excluded.text`, category: sql`excluded.category`, project: sql`excluded.project`, priority: sql`excluded.priority`, done: sql`excluded.done`, comments: sql`excluded.comments`, updatedAt: sql`excluded.updated_at` },
    setWhere: eq(schema.notes.owner, owner),
  });
}

export async function deleteNote(owner: string, id: string) {
  await db().delete(schema.notes).where(and(eq(schema.notes.owner, owner), eq(schema.notes.id, id)));
}

export async function savePrefs(owner: string, p: Prefs) {
  await db().insert(schema.prefs).values({ owner, view: p.view, rails: p.rails, projects: p.projects, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.prefs.owner, set: { view: p.view, rails: p.rails, projects: p.projects, updatedAt: new Date() } });
}
