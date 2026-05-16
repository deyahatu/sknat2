-- Add target gender for accommodations
CREATE TYPE "TargetGender" AS ENUM ('MALE', 'FEMALE');

-- Add fields required by Add/Edit Accommodation use cases
ALTER TABLE "properties"
ADD COLUMN "capacityPerRoom" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "studentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "targetGender" "TargetGender" NOT NULL DEFAULT 'MALE',
ADD COLUMN "services" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "otherServices" TEXT,
ADD COLUMN "policy" TEXT;

-- Store ratings that property owners give to students after bookings
CREATE TABLE "student_ratings" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "bookingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_ratings_bookingId_key" ON "student_ratings"("bookingId");
CREATE INDEX "student_ratings_ownerId_idx" ON "student_ratings"("ownerId");
CREATE INDEX "student_ratings_studentId_idx" ON "student_ratings"("studentId");

ALTER TABLE "student_ratings" ADD CONSTRAINT "student_ratings_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_ratings" ADD CONSTRAINT "student_ratings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_ratings" ADD CONSTRAINT "student_ratings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
