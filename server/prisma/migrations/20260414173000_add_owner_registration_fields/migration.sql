-- Add owner verification fields
ALTER TABLE "users"
ADD COLUMN "idNumber" TEXT,
ADD COLUMN "idPhoto" TEXT;

-- Enforce unique contact and identity data when provided
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_idNumber_key" ON "users"("idNumber");
