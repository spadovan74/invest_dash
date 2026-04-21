-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "brokerage" REAL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "otherFees" REAL DEFAULT 0;
