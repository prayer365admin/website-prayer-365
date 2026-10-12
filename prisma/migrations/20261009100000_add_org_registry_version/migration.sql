-- AlterTable
ALTER TABLE "countries" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "languages" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "org_nodes" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
