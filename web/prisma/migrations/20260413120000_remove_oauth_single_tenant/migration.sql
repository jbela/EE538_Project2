-- Drop single-tenant / local-demo auth tables and decouple library from users.

ALTER TABLE "library_items" DROP CONSTRAINT IF EXISTS "library_items_user_id_fkey";
ALTER TABLE "library_items" DROP COLUMN IF EXISTS "user_id";

DROP TABLE IF EXISTS "api_tokens";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "accounts";
DROP TABLE IF EXISTS "users";
DROP TABLE IF EXISTS "verification_tokens";
