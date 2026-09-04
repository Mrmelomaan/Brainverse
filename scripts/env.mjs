// Shared by the db scripts: loads one .env file into process.env and hands back a pg Client.
// `--prod` reads .env.production.local (fetch it with `vercel env pull --environment=production .env.production.local`),
// otherwise .env.local. An explicit DATABASE_URL in the shell always wins.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

export function loadEnv(argv = process.argv) {
  const prod = argv.includes('--prod');
  const file = prod ? '.env.production.local' : '.env.local';
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error(`No DATABASE_URL in ${file}.` + (prod ? '' : ' For production add --prod.'));
    process.exit(1);
  }
  const host = url.match(/@([^/:?]+)/)?.[1] ?? 'unknown host';
  console.log(`[${prod ? 'PRODUCTION' : 'local'}] ${host}`);
  return { url, prod, file };
}

export async function client(url) {
  const require = createRequire(import.meta.url);
  const { Client } = require('pg');
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

export const TABLES = ['users', 'allowed_emails', 'access_requests', 'prefs', 'notes'];
