-- CreateTable
CREATE TABLE "LunchBreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "startIp" TEXT NOT NULL,
    "endIp" TEXT,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LunchBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LunchBreak_endedAt_dueAt_idx" ON "LunchBreak"("endedAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "LunchBreak_userId_date_key" ON "LunchBreak"("userId", "date");

-- AddForeignKey
ALTER TABLE "LunchBreak" ADD CONSTRAINT "LunchBreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
