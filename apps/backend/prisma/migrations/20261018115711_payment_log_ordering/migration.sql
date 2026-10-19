-- AlterTable
ALTER TABLE "PaymentLog" ADD COLUMN     "attemptCreatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "stageOrder" INTEGER NOT NULL DEFAULT 1;

-- Backfill stageOrder
UPDATE "PaymentLog" SET "stageOrder" = 1 WHERE "stage" = 'USER_INITIATED';
UPDATE "PaymentLog" SET "stageOrder" = 2 WHERE "stage" = 'PROVIDER_COLLECTED';
UPDATE "PaymentLog" SET "stageOrder" = 3 WHERE "stage" = 'WEBHOOK_RECEIVED';
UPDATE "PaymentLog" SET "stageOrder" = 4 WHERE "stage" = 'USER_PAID';

-- Backfill attemptCreatedAt from PaymentAttempt
UPDATE "PaymentLog" pl
SET "attemptCreatedAt" = pa."createdAt"
FROM "PaymentAttempt" pa
WHERE pl."paymentAttemptId" = pa."id";

UPDATE "PaymentLog" SET "attemptCreatedAt" = "createdAt" WHERE "paymentAttemptId" IS NULL;

-- CreateIndex
CREATE INDEX "PaymentLog_teamId_attemptCreatedAt_stageOrder_idx" ON "PaymentLog"("teamId", "attemptCreatedAt" DESC, "stageOrder" ASC);

-- CreateIndex
CREATE INDEX "PaymentLog_paymentAttemptId_stageOrder_idx" ON "PaymentLog"("paymentAttemptId", "stageOrder" ASC);

-- Cluster physical rows so scans and Prisma Studio display newest attempts first and initial-to-final stages
CLUSTER "PaymentLog" USING "PaymentLog_teamId_attemptCreatedAt_stageOrder_idx";
