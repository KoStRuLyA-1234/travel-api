-- CreateTable
CREATE TABLE "SavedRoute" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedRoute_userId_routeId_key" ON "SavedRoute"("userId", "routeId");

-- AddForeignKey
ALTER TABLE "SavedRoute" ADD CONSTRAINT "SavedRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRoute" ADD CONSTRAINT "SavedRoute_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
