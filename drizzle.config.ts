import type { Config } from 'drizzle-kit';
// Optional: `npx drizzle-kit push` applies db/schema.ts to DATABASE_URL. The app also
// bootstraps its two tables on first use, so this is only needed for future schema changes.
export default { schema: './db/schema.ts', out: './drizzle', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? '' } } satisfies Config;
