-- CreateTable
CREATE TABLE "blocked_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "idNumber" TEXT,
    "reason" VARCHAR(200),
    "blockedBy" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_email_key" ON "blocked_identities"("email");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_phone_key" ON "blocked_identities"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_identities_idNumber_key" ON "blocked_identities"("idNumber");
