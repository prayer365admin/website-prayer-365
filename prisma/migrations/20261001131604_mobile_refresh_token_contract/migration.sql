-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'MOBILE_REFRESH';

-- AlterTable
ALTER TABLE "auth_token" ADD COLUMN     "family_id" TEXT,
ADD COLUMN     "installation_id" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "auth_token_type_token_idx" ON "auth_token"("type", "token");
