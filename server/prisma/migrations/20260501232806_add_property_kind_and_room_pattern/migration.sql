-- CreateEnum
CREATE TYPE "PropertyKind" AS ENUM ('APARTMENT', 'STUDIO');

-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('SINGLE', 'DOUBLE');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "campus" TEXT,
ADD COLUMN     "distance" INTEGER,
ADD COLUMN     "kind" "PropertyKind" NOT NULL DEFAULT 'APARTMENT',
ADD COLUMN     "sharedServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "studioPrice" DECIMAL(10,2),
ALTER COLUMN "address" DROP NOT NULL;

-- AlterTable
ALTER TABLE "room_variants" ADD COLUMN     "kind" "RoomKind" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "partiallyOccupied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patternColor" TEXT,
ADD COLUMN     "patternName" TEXT;
