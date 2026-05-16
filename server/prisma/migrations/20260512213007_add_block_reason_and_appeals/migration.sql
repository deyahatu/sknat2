-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blockReason" VARCHAR(200),
ADD COLUMN     "blockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "block_appeals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "block_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_appeals_userId_idx" ON "block_appeals"("userId");

-- CreateIndex
CREATE INDEX "block_appeals_status_idx" ON "block_appeals"("status");

-- AddForeignKey
ALTER TABLE "block_appeals" ADD CONSTRAINT "block_appeals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
