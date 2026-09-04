// One-off, run once after the launch migration: moves rows keyed on an email to the account's Google sub.
//   1. npm run db:migrate -- --prod
//   2. node scripts/allow.mjs add <your email> --prod
//   3. sign in to Brainverse once (creates your users row with the sub)
//   4. node scripts/migrate-owner.mjs <your email> --prod
// The first sign-in plants the tutorial notes under the new key; they are kept, just mark them done.
import { loadEnv, client } from './env.mjs';

const email = process.argv.slice(2).find((a) => a !== '--prod')?.trim().toLowerCase();
if (!email) { console.error('usage: node scripts/migrate-owner.mjs <email> [--prod]'); process.exit(1); }
const { url } = loadEnv();
const c = await client(url);
const u = await c.query('SELECT id FROM users WHERE email = $1 ORDER BY last_seen_at DESC LIMIT 1', [email]);
if (!u.rowCount) { console.error(`No users row for ${email}. Add them to the list and have them sign in once first.`); await c.end(); process.exit(1); }
const sub = u.rows[0].id;
const n = await c.query('SELECT count(*)::int AS n FROM notes WHERE owner = $1', [email]);
if (!n.rows[0].n) { console.log(`Nothing to move: no notes are keyed on ${email}.`); await c.end(); process.exit(0); }
await c.query('BEGIN');
try {
  const moved = await c.query('UPDATE notes SET owner = $1 WHERE owner = $2', [sub, email]);
  // The first sign-in already created a prefs row under the sub; the old email-keyed one is the real one.
  const old = await c.query('SELECT 1 FROM prefs WHERE owner = $1', [email]);
  if (old.rowCount) {
    await c.query('DELETE FROM prefs WHERE owner = $1', [sub]);
    await c.query('UPDATE prefs SET owner = $1 WHERE owner = $2', [sub, email]);
  }
  await c.query('COMMIT');
  console.log(`moved ${moved.rowCount} notes${old.rowCount ? ' and prefs' : ''} from ${email} to ${sub}`);
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  await c.end();
}
