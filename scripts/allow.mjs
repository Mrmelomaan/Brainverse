// The invite list, from a laptop. Nothing to deploy.
//   node scripts/allow.mjs add jan@gmail.com "Jan from padel" [--prod]
//   node scripts/allow.mjs remove jan@gmail.com [--prod]
//   node scripts/allow.mjs list [--prod]            (also shows who is waiting)
import { loadEnv, client } from './env.mjs';

const [cmd, emailArg, ...rest] = process.argv.slice(2).filter((a) => a !== '--prod');
const email = emailArg?.trim().toLowerCase();
if (!['add', 'remove', 'list'].includes(cmd) || (cmd !== 'list' && !email)) {
  console.error('usage: node scripts/allow.mjs <add|remove> <email> [note] | list   [--prod]');
  process.exit(1);
}
const { url } = loadEnv();
const c = await client(url);
if (cmd === 'add') {
  const note = rest.join(' ') || null;
  await c.query('INSERT INTO allowed_emails (email, note) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET note = COALESCE(EXCLUDED.note, allowed_emails.note)', [email, note]);
  const r = await c.query('DELETE FROM access_requests WHERE email = $1', [email]);
  console.log(`allowed ${email}${r.rowCount ? ' (and cleared their waiting-room request)' : ''}. They can reload Brainverse now.`);
} else if (cmd === 'remove') {
  const r = await c.query('DELETE FROM allowed_emails WHERE email = $1', [email]);
  console.log(r.rowCount ? `removed ${email}. Their next request is refused; their notes are kept until they delete their account.` : `${email} was not on the list`);
} else {
  const a = await c.query('SELECT a.email, a.note, a.added_at, u.name, u.last_seen_at FROM allowed_emails a LEFT JOIN users u ON u.email = a.email ORDER BY a.added_at');
  console.log(`\nAllowed (${a.rowCount}):`);
  for (const r of a.rows) console.log(`  ${r.email.padEnd(36)} ${(r.name ?? '').padEnd(24)} ${r.last_seen_at ? 'last seen ' + r.last_seen_at.toISOString().slice(0, 10) : 'never signed in'}${r.note ? '   ' + r.note : ''}`);
  const w = await c.query('SELECT email, name, attempts, first_at, last_at FROM access_requests ORDER BY last_at DESC');
  console.log(`\nWaiting (${w.rowCount}):`);
  for (const r of w.rows) console.log(`  ${r.email.padEnd(36)} ${(r.name ?? '').padEnd(24)} ${r.attempts}x, last ${r.last_at.toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log();
}
await c.end();
