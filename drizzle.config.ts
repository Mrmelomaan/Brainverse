import type { Config } from 'drizzle-kit';

// Schema changes: edit db/schema.ts, then `npm run db:generate` (writes drizzle/NNNN_*.sql) and
// `npm run db:migrate` (applies them). Both are run by hand from a laptop, never on deploy.
// scripts/db.mjs loads the right .env file and prefers the unpooled connection for tooling.
export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
} satisfies Config;
