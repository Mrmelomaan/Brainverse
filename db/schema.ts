import { boolean, index, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import type { Comment, Rails } from '@/lib/model';

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
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
