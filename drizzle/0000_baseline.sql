-- Baseline: these two tables already exist in production (created by the old on-first-request bootstrap),
-- so this migration is written to be a no-op there and a real create on a fresh database.
CREATE TABLE IF NOT EXISTS "notes" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"category" text,
	"project" text,
	"priority" smallint,
	"done" boolean DEFAULT false NOT NULL,
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prefs" (
	"owner" text PRIMARY KEY NOT NULL,
	"view" text DEFAULT 'category' NOT NULL,
	"rails" jsonb DEFAULT '{"_un":false,"_done":false}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_owner_idx" ON "notes" USING btree ("owner");