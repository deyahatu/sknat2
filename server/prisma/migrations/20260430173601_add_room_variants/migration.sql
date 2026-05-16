/*
  Warnings:

  - You are about to drop the column `capacityPerRoom` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `rooms` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `services` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `studentsCount` on the `properties` table. All the data in the column will be lost.
  - Added the required column `roomVariantId` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "properties_price_idx";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "roomVariantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "properties" DROP COLUMN "capacityPerRoom",
DROP COLUMN "price",
DROP COLUMN "rooms",
DROP COLUMN "services",
DROP COLUMN "studentsCount";

-- CreateTable
CREATE TABLE "room_variants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "totalBeds" INTEGER NOT NULL DEFAULT 1,
    "occupiedBeds" INTEGER NOT NULL DEFAULT 0,
    "fullPrice" DECIMAL(10,2) NOT NULL,
    "halfPrice" DECIMAL(10,2),
    "images" TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_variants_propertyId_idx" ON "room_variants"("propertyId");

-- CreateIndex
CREATE INDEX "bookings_roomVariantId_idx" ON "bookings"("roomVariantId");

-- AddForeignKey
ALTER TABLE "room_variants" ADD CONSTRAINT "room_variants_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomVariantId_fkey" FOREIGN KEY ("roomVariantId") REFERENCES "room_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
