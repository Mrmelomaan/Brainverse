import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import type { Comment, Rails, UserProject } from '@/lib/model';

/** `owner` on notes/prefs is the Google account's stable `sub` id (users.id), never the email. */
export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    text: text('text').notNull().default(''),
    category: text('category'),
    project: text('project'),
    priority: smallint('priority'),
    done: boolean('done').notNull().default(false),
    comments: jsonb('comments').$type<Comment[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notes_owner_idx').on(t.owner)],
);

export const prefs = pgTable('prefs', {
  owner: text('owner').primaryKey(),
  view: text('view').notNull().default('category'),
  rails: jsonb('rails').$type<Rails>().notNull().default({ _un: false, _done: false }),
  projects: jsonb('projects').$type<UserProject[]>().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Accounts that have been let in at least once. id = Google `sub`. */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_email_idx').on(t.email)],
);

/** The invite list. Lower-cased Google account emails that may enter. Managed with `npm run db:allow`. */
export const allowedEmails = pgTable('allowed_emails', {
  email: text('email').primaryKey(),
  note: text('note'),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The waiting room: people who signed in but are not on the list. One row per Google account, never expires. */
export const accessRequests = pgTable('access_requests', {
  sub: text('sub').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  attempts: integer('attempts').notNull().default(1),
  firstAt: timestamp('first_at', { withTimezone: true }).notNull().defaultNow(),
  lastAt: timestamp('last_at', { withTimezone: true }).notNull().defaultNow(),
});
