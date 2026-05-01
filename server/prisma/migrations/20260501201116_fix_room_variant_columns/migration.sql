/*
  Warnings:

  - You are about to drop the column `occupiedBeds` on the `room_variants` table. All the data in the column will be lost.
  - You are about to drop the column `totalBeds` on the `room_variants` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "room_variants" DROP COLUMN "occupiedBeds",
DROP COLUMN "totalBeds",
ADD COLUMN     "isOccupied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roomNumber" TEXT;
