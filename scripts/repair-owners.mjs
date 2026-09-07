// One-off repair for universes that were keyed on a random per-session id (jwt bug fixed in auth.config.ts).
//   node scripts/repair-owners.mjs --prod <email>=<ownerPrefix>[,<ownerPrefix>...] [<email>=...]
// Each prefix (or full key) names an orphaned owner whose notes/prefs belong to <email>'s Google account.
// Also folds any users row with a non-numeric id (random) into the numeric-sub row with the same email.
// Merges notes, drops duplicate tutorial copies, keeps the most recently updated prefs. Runs in one transaction.
import { loadEnv, client } from './env.mjs';
import { SEED } from '../lib/model.ts';

const args = process.argv.slice(2).filter((a) => a !== '--prod');
const { url } = loadEnv();
const c = await client(url);
const seedTexts = SEED.map((n) => n.text);
const users = (await c.query('SELECT id, email FROM users')).rows;
const real = (email) => users.find((u) => u.email === email && /^\d+$/.test(u.id))?.id;

await c.query('BEGIN');
try {
  const plan = new Map(); // targetSub -> Set(sourceOwner)
  for (const u of users) if (!/^\d+$/.test(u.id)) { const t = real(u.email); if (t) { plan.set(t, (plan.get(t) ?? new Set()).add(u.id)); } }
  for (const a of args) {
    const [email, list] = a.split('='); const t = real(email.trim().toLowerCase());
    if (!t) throw new Error(`no numeric-sub users row for ${email}; have them sign in once after the fix is deployed`);
    for (const pre of (list ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
      const rows = (await c.query("SELECT DISTINCT owner FROM (SELECT owner FROM notes UNION SELECT owner FROM prefs) o WHERE owner LIKE $1", [pre + '%'])).rows;
      if (rows.length !== 1) throw new Error(`prefix ${pre} matches ${rows.length} owners`);
      if (rows[0].owner !== t) plan.set(t, (plan.get(t) ?? new Set()).add(rows[0].owner));
    }
  }
  for (const [target, sources] of plan) {
    const src = [...sources];
    const moved = await c.query('UPDATE notes SET owner = $1 WHERE owner = ANY($2)', [target, src]);
    // Keep one copy of each tutorial note per account (the earliest), drop the rest.
    const dup = await c.query(`DELETE FROM notes n USING notes k WHERE n.owner = $1 AND k.owner = $1 AND n.text = k.text AND n.text = ANY($2) AND k.created_at < n.created_at`, [target, seedTexts]);
    const best = (await c.query('SELECT owner FROM prefs WHERE owner = $1 OR owner = ANY($2) ORDER BY updated_at DESC LIMIT 1', [target, src])).rows[0]?.owner;
    if (best && best !== target) { await c.query('DELETE FROM prefs WHERE owner = $1', [target]); await c.query('UPDATE prefs SET owner = $1 WHERE owner = $2', [target, best]); }
    await c.query('DELETE FROM prefs WHERE owner = ANY($1)', [src]);
    await c.query('DELETE FROM users WHERE id = ANY($1)', [src]);
    console.log(`${target.slice(0, 6)}…: merged ${src.length} orphan universe(s), moved ${moved.rowCount} notes, removed ${dup.rowCount} duplicate tutorial notes`);
  }
  await c.query('COMMIT');
} catch (e) { await c.query('ROLLBACK'); throw e; } finally { await c.end(); }
