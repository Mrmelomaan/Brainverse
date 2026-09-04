// Dumps every table to backups/brainverse-<env>-<timestamp>.json. No pg_dump needed.
// Run before every migration: `npm run db:backup -- --prod`. Restore with scripts/restore.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv, client, TABLES } from './env.mjs';

const { url, prod } = loadEnv();
const c = await client(url);
const dump = { version: 1, takenAt: new Date().toISOString(), tables: {} };
for (const t of TABLES) {
  try {
    const r = await c.query(`SELECT * FROM "${t}"`);
    dump.tables[t] = r.rows;
    console.log(`${t}: ${r.rowCount} rows`);
  } catch (e) {
    if (e.code === '42P01') console.log(`${t}: (table does not exist yet)`);
    else throw e;
  }
}
await c.end();
mkdirSync('backups', { recursive: true });
const stamp = dump.takenAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const file = `backups/brainverse-${prod ? 'prod' : 'local'}-${stamp}.json`;
writeFileSync(file, JSON.stringify(dump, null, 1));
console.log('wrote', file);
