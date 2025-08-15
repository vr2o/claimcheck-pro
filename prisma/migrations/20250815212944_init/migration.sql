-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "claimText" TEXT NOT NULL,
    "claimLanguage" TEXT NOT NULL,
    "originalInput" TEXT NOT NULL,
    "context" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "qualityScore" DOUBLE PRECISION,
    "diversityIndex" DOUBLE PRECISION,
    "consensusData" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "language" TEXT,
    "domain" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "discoveredVia" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3),
    "credibilityScore" DOUBLE PRECISION NOT NULL,
    "directnessScore" DOUBLE PRECISION NOT NULL,
    "methodologyScore" DOUBLE PRECISION NOT NULL,
    "bias" JSONB,
    "stance" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacheEntry" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "ttl" TIMESTAMP(3) NOT NULL,
    "tags" TEXT[],
    "sizeBytes" INTEGER,
    "hitCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "EvidenceSource_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
