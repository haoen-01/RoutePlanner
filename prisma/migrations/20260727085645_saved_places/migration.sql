-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "terrainCounts" JSONB NOT NULL DEFAULT '{}',
    "environmentCounts" JSONB NOT NULL DEFAULT '{}',
    "trafficCounts" JSONB NOT NULL DEFAULT '{}',
    "safetyCounts" JSONB NOT NULL DEFAULT '{}',
    "sceneryCounts" JSONB NOT NULL DEFAULT '{}',
    "hydrationCounts" JSONB NOT NULL DEFAULT '{}',
    "toiletCounts" JSONB NOT NULL DEFAULT '{}',
    "shadeCounts" JSONB NOT NULL DEFAULT '{}',
    "timingCounts" JSONB NOT NULL DEFAULT '{}',
    "choiceSignals" JSONB NOT NULL DEFAULT '{}',
    "totalRunsCompleted" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "startLabel" TEXT,
    "locationFamiliarity" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "routeType" TEXT NOT NULL,
    "terrain" TEXT NOT NULL,
    "environment" JSONB NOT NULL,
    "traffic" TEXT NOT NULL,
    "safety" TEXT NOT NULL,
    "scenery" TEXT NOT NULL,
    "hydration" TEXT NOT NULL,
    "toilet" TEXT NOT NULL,
    "shade" TEXT NOT NULL,
    "timing" TEXT NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteOption" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'synthetic',
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "estimatedDurationMin" INTEGER NOT NULL,
    "routeType" TEXT NOT NULL,
    "elevationGainM" DOUBLE PRECISION NOT NULL,
    "highestPointM" DOUBLE PRECISION NOT NULL,
    "maxInclinePct" DOUBLE PRECISION NOT NULL,
    "difficulty" TEXT NOT NULL,
    "safetyScore" INTEGER NOT NULL,
    "sceneryScore" INTEGER NOT NULL,
    "trafficScore" INTEGER NOT NULL,
    "convenienceScore" INTEGER NOT NULL,
    "shadeScore" INTEGER NOT NULL,
    "weatherProtectionScore" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "hydrationPoints" JSONB NOT NULL,
    "toiletPoints" JSONB NOT NULL,
    "shelterPoints" JSONB NOT NULL,
    "weatherSummary" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommendation" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RouteOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunSession" (
    "id" TEXT NOT NULL,
    "routeOptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "distanceCompletedKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgPaceMinPerKm" DOUBLE PRECISION,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "track" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "RunSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "name" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'overpass',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPlace_userId_label_key" ON "SavedPlace"("userId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "PreferenceProfile_userId_key" ON "PreferenceProfile"("userId");

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceProfile" ADD CONSTRAINT "PreferenceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteOption" ADD CONSTRAINT "RouteOption_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunSession" ADD CONSTRAINT "RunSession_routeOptionId_fkey" FOREIGN KEY ("routeOptionId") REFERENCES "RouteOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
