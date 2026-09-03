import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, sql } from 'drizzle-orm';
import * as schema from './schema';
import { normaliseNote, type Note, type Prefs, type View } from '@/lib/model';

export const hasDatabase = () => !!process.env.DATABASE_URL;

type DB = NodePgDatabase<typeof schema>;
const g = globalThis as unknown as { __bvPool?: Pool; __bvDb?: DB; __bvSchema?: Promise<void> };

function db(): DB {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!g.__bvDb) {
    g.__bvPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10_000 });
    g.__bvDb = drizzle(g.__bvPool, { schema });
  }
  return g.__bvDb;
}

/** Idempotent bootstrap so the app works the moment DATABASE_URL exists (no migration step). */
async function ready(): Promise<DB> {
  const d = db();
  if (!g.__bvSchema) {
    g.__bvSchema = (async () => {
      await d.execute(sql`CREATE TABLE IF NOT EXISTS notes (
        id text PRIMARY KEY, owner text NOT NULL, text text NOT NULL DEFAULT '', category text, project text, priority smallint,
        done boolean NOT NULL DEFAULT false, comments jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
      await d.execute(sql`CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes(owner)`);
      await d.execute(sql`CREATE TABLE IF NOT EXISTS prefs (
        owner text PRIMARY KEY, view text NOT NULL DEFAULT 'category',
        rails jsonb NOT NULL DEFAULT '{"_un":false,"_done":false}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now())`);
    })().catch((e) => { g.__bvSchema = undefined; throw e; });
  }
  await g.__bvSchema;
  return d;
}

const toNote = (r: typeof schema.notes.$inferSelect): Note =>
  normaliseNote({ id: r.id, text: r.text, category: r.category as Note['category'], project: r.project as Note['project'], priority: r.priority as Note['priority'], done: r.done, comments: r.comments, createdAt: r.createdAt.toISOString() });

export async function loadUniverse(owner: string): Promise<{ notes: Note[]; prefs: Prefs }> {
  const d = await ready();
  const rows = await d.select().from(schema.notes).where(eq(schema.notes.owner, owner)).orderBy(asc(schema.notes.createdAt), asc(schema.notes.id));
  const p = await d.select().from(schema.prefs).where(eq(schema.prefs.owner, owner)).limit(1);
  const view = (['category', 'project', 'priority'] as View[]).includes(p[0]?.view as View) ? (p[0].view as View) : 'category';
  return { notes: rows.map(toNote), prefs: { view, rails: { _un: !!p[0]?.rails?._un, _done: !!p[0]?.rails?._done } } };
}

export async function upsertNotes(owner: string, list: Note[]) {
  if (!list.length) return;
  const d = await ready();
  const values = list.map((n) => ({ id: n.id, owner, text: n.text, category: n.category, project: n.project, priority: n.priority, done: n.done, comments: n.comments, createdAt: new Date(n.createdAt), updatedAt: new Date() }));
  // Rows are scoped by owner: an id that belongs to another owner is never touched.
  await d.insert(schema.notes).values(values).onConflictDoUpdate({
    target: schema.notes.id,
    set: { text: sql`excluded.text`, category: sql`excluded.category`, project: sql`excluded.project`, priority: sql`excluded.priority`, done: sql`excluded.done`, comments: sql`excluded.comments`, updatedAt: sql`excluded.updated_at` },
    setWhere: eq(schema.notes.owner, owner),
  });
}

export async function deleteNote(owner: string, id: string) {
  const d = await ready();
  await d.delete(schema.notes).where(and(eq(schema.notes.owner, owner), eq(schema.notes.id, id)));
}

export async function savePrefs(owner: string, p: Prefs) {
  const d = await ready();
  await d.insert(schema.prefs).values({ owner, view: p.view, rails: p.rails, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.prefs.owner, set: { view: p.view, rails: p.rails, updatedAt: new Date() } });
}
