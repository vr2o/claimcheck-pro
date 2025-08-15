-- AlterTable
ALTER TABLE "EvidenceSource" ALTER COLUMN "domain" DROP NOT NULL,
ALTER COLUMN "sourceType" DROP NOT NULL,
ALTER COLUMN "discoveredVia" DROP NOT NULL;
