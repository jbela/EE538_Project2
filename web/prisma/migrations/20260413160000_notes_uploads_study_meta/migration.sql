-- Personal notes, file uploads, and future AI/study artifact hook.

ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "note_content" TEXT;
ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "original_file_name" TEXT;
ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "stored_file_name" TEXT;
ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;
ALTER TABLE "library_items" ADD COLUMN IF NOT EXISTS "study_artifacts" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "library_items_stored_file_name_key" ON "library_items"("stored_file_name");
