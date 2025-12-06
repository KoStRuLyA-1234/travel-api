-- CreateTable
CREATE TABLE "TagHint" (
    "id" SERIAL NOT NULL,
    "tag" TEXT NOT NULL,
    "hint" TEXT NOT NULL,

    CONSTRAINT "TagHint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TagHint_tag_key" ON "TagHint"("tag");
