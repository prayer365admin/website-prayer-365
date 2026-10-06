-- Add optimistic concurrency control for central pastor profile updates.
ALTER TABLE "pastors"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
