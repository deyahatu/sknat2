-- Add `processedAt` to record exactly when a withdrawal was actually
-- transferred (status moved to COMPLETED). UC-24 requires displaying this
-- to the owner; `updatedAt` alone gets clobbered by any later update.

ALTER TABLE "withdraw_requests"
  ADD COLUMN "processedAt" TIMESTAMP(3);
