-- AlterTable
ALTER TABLE "hackathon" ADD COLUMN     "scoringLockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "criterion" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hackathon_judge" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hackathon_judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "criterion_hackathonId_idx" ON "criterion"("hackathonId");

-- CreateIndex
CREATE UNIQUE INDEX "criterion_hackathonId_name_key" ON "criterion"("hackathonId", "name");

-- CreateIndex
CREATE INDEX "hackathon_judge_userId_idx" ON "hackathon_judge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "hackathon_judge_hackathonId_userId_key" ON "hackathon_judge"("hackathonId", "userId");

-- CreateIndex
CREATE INDEX "score_projectId_idx" ON "score"("projectId");

-- CreateIndex
CREATE INDEX "score_judgeId_idx" ON "score"("judgeId");

-- CreateIndex
CREATE INDEX "score_criterionId_idx" ON "score"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "score_judgeId_projectId_criterionId_key" ON "score"("judgeId", "projectId", "criterionId");

-- AddForeignKey
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_judge" ADD CONSTRAINT "hackathon_judge_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "hackathon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hackathon_judge" ADD CONSTRAINT "hackathon_judge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score" ADD CONSTRAINT "score_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score" ADD CONSTRAINT "score_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score" ADD CONSTRAINT "score_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "criterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

