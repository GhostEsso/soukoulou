-- CreateEnum
CREATE TYPE "CouncilDecision" AS ENUM ('PROMOTED', 'REPEATING');

-- CreateTable
CREATE TABLE "CouncilNote" (
    "studentId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "comment" TEXT,
    "decision" "CouncilDecision",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouncilNote_pkey" PRIMARY KEY ("studentId","yearId","scope")
);

-- AddForeignKey
ALTER TABLE "CouncilNote" ADD CONSTRAINT "CouncilNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouncilNote" ADD CONSTRAINT "CouncilNote_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
