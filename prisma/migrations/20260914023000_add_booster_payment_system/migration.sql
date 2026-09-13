-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VODAFONE_CASH', 'INSTAPAY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentNumber" TEXT;

-- CreateTable
CREATE TABLE "BoosterPaymentTransaction" (
    "id" TEXT NOT NULL,
    "boosterId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "exchangeRate" DECIMAL(12,4) NOT NULL,
    "amountEgp" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoosterPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransactionAllocation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransactionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoosterPaymentTransaction_boosterId_paidAt_idx" ON "BoosterPaymentTransaction"("boosterId", "paidAt");

-- CreateIndex
CREATE INDEX "BoosterPaymentTransaction_boosterId_month_idx" ON "BoosterPaymentTransaction"("boosterId", "month");

-- CreateIndex
CREATE INDEX "PaymentTransactionAllocation_transactionId_idx" ON "PaymentTransactionAllocation"("transactionId");

-- CreateIndex
CREATE INDEX "PaymentTransactionAllocation_paymentId_idx" ON "PaymentTransactionAllocation"("paymentId");

-- AddForeignKey
ALTER TABLE "BoosterPaymentTransaction" ADD CONSTRAINT "BoosterPaymentTransaction_boosterId_fkey" FOREIGN KEY ("boosterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransactionAllocation" ADD CONSTRAINT "PaymentTransactionAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "BoosterPaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransactionAllocation" ADD CONSTRAINT "PaymentTransactionAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
