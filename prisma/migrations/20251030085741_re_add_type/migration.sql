-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('PAYER', 'RECIPIENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'RECIPIENT';
