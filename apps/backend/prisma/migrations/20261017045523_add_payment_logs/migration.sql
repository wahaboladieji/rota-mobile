-- CreateEnum
CREATE TYPE "PaymentLogStage" AS ENUM ('USER_INITIATED', 'PROVIDER_COLLECTED', 'WEBHOOK_RECEIVED', 'USER_PAID');

-- CreateTable
CREATE TABLE "PaymentLog" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "paymentAttemptId" UUID,
    "stage" "PaymentLogStage" NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentLog_teamId_createdAt_idx" ON "PaymentLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentLog_paymentAttemptId_createdAt_idx" ON "PaymentLog"("paymentAttemptId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLog" ADD CONSTRAINT "PaymentLog_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
