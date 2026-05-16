-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('STUDENT_VS_OWNER', 'OWNER_VS_STUDENT');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "complainantId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "bookingId" TEXT,
    "subject" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_complainantId_idx" ON "complaints"("complainantId");

-- CreateIndex
CREATE INDEX "complaints_targetUserId_idx" ON "complaints"("targetUserId");

-- CreateIndex
CREATE INDEX "complaints_bookingId_idx" ON "complaints"("bookingId");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_complainantId_fkey" FOREIGN KEY ("complainantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
