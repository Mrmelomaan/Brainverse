// Restores a backup made by scripts/backup.mjs: `node scripts/restore.mjs backups/<file>.json [--prod] --yes`.
// Replaces the contents of every table in the file. Run the migrations first if the schema moved on.
import { readFileSync } from 'node:fs';
import { loadEnv, client, TABLES } from './env.mjs';

const file = process.argv[2];
if (!file || !file.endsWith('.json')) { console.error('usage: node scripts/restore.mjs <backup.json> [--prod] --yes'); process.exit(1); }
const { url, prod } = loadEnv();
if (!process.argv.includes('--yes')) { console.error(`This REPLACES all rows in ${prod ? 'PRODUCTION' : 'the local database'}. Add --yes to continue.`); process.exit(1); }
const dump = JSON.parse(readFileSync(file, 'utf8'));
const c = await client(url);
await c.query('BEGIN');
try {
  for (const t of TABLES) {
    const rows = dump.tables[t];
    if (!rows) continue;
    await c.query(`DELETE FROM "${t}"`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((k) => (row[k] !== null && typeof row[k] === 'object' && !(row[k] instanceof Date) ? JSON.stringify(row[k]) : row[k]));
      await c.query(`INSERT INTO "${t}" (${cols.map((k) => `"${k}"`).join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')})`, vals);
    }
    console.log(`${t}: ${rows.length} rows`);
  }
  await c.query('COMMIT');
  console.log('restored', file);
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  await c.end();
}
