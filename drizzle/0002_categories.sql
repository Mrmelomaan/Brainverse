ALTER TABLE "prefs" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Accounts from before per-user categories keep working: give every existing prefs row the four starter areas
-- (same ids the old fixed categories had, so no note moves). Runs once; already-filled rows are skipped.
UPDATE "prefs" SET "categories" = '[{"id":"sport","label":"Sport","icon":"dumbbell-01","hue":150},{"id":"food","label":"Food","icon":"restaurant-02","hue":60},{"id":"habits","label":"Habits","icon":"repeat","hue":310},{"id":"business","label":"Business","icon":"briefcase-01","hue":240}]'::jsonb WHERE "categories" = '[]'::jsonb;
