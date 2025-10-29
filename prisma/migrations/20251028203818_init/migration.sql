-- CreateEnum
CREATE TYPE "StreamStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STREAM_START', 'STREAM_STOP', 'WITHDRAWAL', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "flowRate" TEXT NOT NULL,
    "totalAmount" TEXT NOT NULL,
    "withdrawnAmount" TEXT NOT NULL DEFAULT '0',
    "status" "StreamStatus" NOT NULL DEFAULT 'ACTIVE',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "streamId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "totalEarned" TEXT NOT NULL DEFAULT '0',
    "totalWithdrawn" TEXT NOT NULL DEFAULT '0',
    "availableBalance" TEXT NOT NULL DEFAULT '0',
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Balance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "Stream_payerId_idx" ON "Stream"("payerId");

-- CreateIndex
CREATE INDEX "Stream_recipientId_idx" ON "Stream"("recipientId");

-- CreateIndex
CREATE INDEX "Stream_status_idx" ON "Stream"("status");

-- CreateIndex
CREATE INDEX "Stream_startTime_idx" ON "Stream"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_streamId_idx" ON "Transaction"("streamId");

-- CreateIndex
CREATE INDEX "Transaction_txHash_idx" ON "Transaction"("txHash");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Balance_userId_idx" ON "Balance"("userId");

-- CreateIndex
CREATE INDEX "Balance_tokenAddress_idx" ON "Balance"("tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Balance_userId_tokenAddress_key" ON "Balance"("userId", "tokenAddress");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_fromAddress_fkey" FOREIGN KEY ("fromAddress") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balance" ADD CONSTRAINT "Balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
