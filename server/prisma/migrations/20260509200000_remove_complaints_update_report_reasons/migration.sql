-- Drop the complaints feature (UC-34 ticket system removed; Reports/UC-41 now covers comment/rating reports)

-- Drop ticket_replies first (it references complaints)
DROP TABLE IF EXISTS "ticket_replies";

-- Drop complaints table
DROP TABLE IF EXISTS "complaints";

-- Drop the unused complaint enums
DROP TYPE IF EXISTS "ComplaintStatus";
DROP TYPE IF EXISTS "ComplaintType";

-- Align ReportReason values with the spec (UC-41):
-- offensive language, false information, harassment, policy violation
ALTER TYPE "ReportReason" RENAME VALUE 'INCORRECT' TO 'FALSE_INFO';
ALTER TYPE "ReportReason" RENAME VALUE 'SPAM' TO 'POLICY_VIOLATION';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'HARASSMENT';
