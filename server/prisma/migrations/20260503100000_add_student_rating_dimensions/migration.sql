-- Replace single `rating` column on student_ratings with 4-dimension ratings
-- (behavior, cleanliness, communication, overall) per UC-25 spec.

ALTER TABLE "student_ratings"
  ADD COLUMN "behaviorRating"      INTEGER,
  ADD COLUMN "cleanlinessRating"   INTEGER,
  ADD COLUMN "communicationRating" INTEGER,
  ADD COLUMN "overallRating"       INTEGER;

-- Backfill existing rows: copy old `rating` into all four dimensions
UPDATE "student_ratings"
SET
  "behaviorRating"      = "rating",
  "cleanlinessRating"   = "rating",
  "communicationRating" = "rating",
  "overallRating"       = "rating";

-- Now enforce NOT NULL on the new columns
ALTER TABLE "student_ratings"
  ALTER COLUMN "behaviorRating"      SET NOT NULL,
  ALTER COLUMN "cleanlinessRating"   SET NOT NULL,
  ALTER COLUMN "communicationRating" SET NOT NULL,
  ALTER COLUMN "overallRating"       SET NOT NULL;

-- Drop the old single `rating` column
ALTER TABLE "student_ratings" DROP COLUMN "rating";
