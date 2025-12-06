-- CreateTable
CREATE TABLE "Route" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "desc" TEXT NOT NULL,
    "theme" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "itinerary" JSONB NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);
