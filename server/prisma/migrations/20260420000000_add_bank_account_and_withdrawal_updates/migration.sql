-- Add COMPLETED to WithdrawStatus enum
ALTER TYPE "WithdrawStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- Add bank account fields to users
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;

-- Add snapshot and rejection fields to withdraw_requests
ALTER TABLE "withdraw_requests"
ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountHolder" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
