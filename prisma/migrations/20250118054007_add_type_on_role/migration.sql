-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('SYSTEM', 'USER');

-- AlterTable
ALTER TABLE "role" ADD COLUMN     "type" "RoleType" NOT NULL DEFAULT 'USER';
