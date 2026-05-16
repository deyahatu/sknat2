-- Add booking renewal support: a renewal is a new Booking row that points
-- to the original booking via parentBookingId. The reminder timestamp lets
-- the scheduler avoid sending the "5-days-left" notification more than once.

ALTER TABLE "bookings" ADD COLUMN "parentBookingId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "renewalReminderSentAt" TIMESTAMP(3);

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parentBookingId_fkey"
  FOREIGN KEY ("parentBookingId") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bookings_parentBookingId_idx" ON "bookings"("parentBookingId");
