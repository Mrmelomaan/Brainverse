// `node scripts/db.mjs <generate|migrate|studio> [--prod]`: loads the env file, then runs drizzle-kit.
import { spawnSync } from 'node:child_process';
import { loadEnv } from './env.mjs';

const cmd = process.argv[2];
if (!['generate', 'migrate', 'studio'].includes(cmd)) {
  console.error('usage: node scripts/db.mjs <generate|migrate|studio> [--prod]');
  process.exit(1);
}
if (cmd !== 'generate') loadEnv();
if (cmd === 'migrate' && process.argv.includes('--prod')) console.log('Applying migrations to PRODUCTION. Run `npm run db:backup -- --prod` first.');
const r = spawnSync('npx', ['drizzle-kit', cmd], { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
