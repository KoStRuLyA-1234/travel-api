/*
  Warnings:

  - You are about to drop the column `city` on the `Route` table. All the data in the column will be lost.
  - Added the required column `cityId` to the `Route` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Route" DROP COLUMN "city",
ADD COLUMN     "cityId" INTEGER NOT NULL,
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "tags" DROP DEFAULT;

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
