-- DropIndex
DROP INDEX "Parent_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Parent_schoolId_userId_key" ON "Parent"("schoolId", "userId");

