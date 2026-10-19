-- Drop old indexes
DROP INDEX IF EXISTS "PaymentLog_teamId_attemptCreatedAt_stageOrder_idx";
DROP INDEX IF EXISTS "PaymentLog_paymentAttemptId_stageOrder_idx";
DROP INDEX IF EXISTS "PaymentLog_paymentAttemptId_createdAt_idx";

-- Ensure each stage within a payment attempt has sequential, non-colliding createdAt timestamps
UPDATE "PaymentLog" SET "createdAt" = "attemptCreatedAt" WHERE "stage" = 'USER_INITIATED';
UPDATE "PaymentLog" SET "createdAt" = "attemptCreatedAt" + INTERVAL '1 second' WHERE "stage" = 'PROVIDER_COLLECTED';
UPDATE "PaymentLog" SET "createdAt" = "attemptCreatedAt" + INTERVAL '2 seconds' WHERE "stage" = 'WEBHOOK_RECEIVED';
UPDATE "PaymentLog" SET "createdAt" = "attemptCreatedAt" + INTERVAL '3 seconds' WHERE "stage" = 'USER_PAID';

-- AlterTable: Drop column stageOrder
ALTER TABLE "PaymentLog" DROP COLUMN "stageOrder";

-- CreateIndex
CREATE INDEX "PaymentLog_teamId_attemptCreatedAt_createdAt_idx" ON "PaymentLog"("teamId", "attemptCreatedAt" DESC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PaymentLog_paymentAttemptId_createdAt_idx" ON "PaymentLog"("paymentAttemptId", "createdAt" ASC);

-- Cluster physical rows so scans and Prisma Studio display newest attempts first and initial-to-final stages
CLUSTER "PaymentLog" USING "PaymentLog_teamId_attemptCreatedAt_createdAt_idx";
