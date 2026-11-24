-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('DUE_SOON', 'OVERDUE');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "receiptSeq" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Scolarité',
    "sex" "Sex",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleLine" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueOn" DATE NOT NULL,

    CONSTRAINT "FeeScheduleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFee" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeLine" (
    "id" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueOn" DATE NOT NULL,

    CONSTRAINT "StudentFeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerRef" TEXT,
    "receiptNumber" TEXT,
    "recordedById" TEXT,
    "parentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "processedById" TEXT,
    "providerRef" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReminder" (
    "id" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FeeScheduleToLevel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FeeScheduleToLevel_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "FeeSchedule_schoolId_yearId_idx" ON "FeeSchedule"("schoolId", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScheduleLine_scheduleId_position_key" ON "FeeScheduleLine"("scheduleId", "position");

-- CreateIndex
CREATE INDEX "StudentFee_schoolId_yearId_idx" ON "StudentFee"("schoolId", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFee_studentId_yearId_key" ON "StudentFee"("studentId", "yearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeLine_studentFeeId_position_key" ON "StudentFeeLine"("studentFeeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_providerRef_key" ON "FeePayment"("providerRef");

-- CreateIndex
CREATE INDEX "FeePayment_schoolId_status_idx" ON "FeePayment"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_schoolId_receiptNumber_key" ON "FeePayment"("schoolId", "receiptNumber");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReminder_studentFeeId_position_kind_key" ON "FeeReminder"("studentFeeId", "position", "kind");

-- CreateIndex
CREATE INDEX "_FeeScheduleToLevel_B_index" ON "_FeeScheduleToLevel"("B");

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleLine" ADD CONSTRAINT "FeeScheduleLine_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeLine" ADD CONSTRAINT "StudentFeeLine_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminder" ADD CONSTRAINT "FeeReminder_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeeScheduleToLevel" ADD CONSTRAINT "_FeeScheduleToLevel_A_fkey" FOREIGN KEY ("A") REFERENCES "FeeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeeScheduleToLevel" ADD CONSTRAINT "_FeeScheduleToLevel_B_fkey" FOREIGN KEY ("B") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
