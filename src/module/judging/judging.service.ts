import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { AssignJudgeDto } from './dto/assign-judge.dto.js';
import { CreateCriterionDto } from './dto/create-criterion.dto.js';
import { SubmitScoresDto } from './dto/submit-scores.dto.js';
import { UpdateCriterionDto } from './dto/update-criterion.dto.js';

const criterionSelect = {
  id: true,
  name: true,
  weight: true,
  position: true,
} as const;

const criterionOrder = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] as const;

interface ScoreRow {
  judgeId: string;
  criterionId: string;
  value: number;
}

@Injectable()
export class JudgingService {
  constructor(private readonly prisma: PrismaService) {}

  async createCriterion(
    hackathonId: string,
    dto: CreateCriterionDto,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);
    this.assertRubricEditable(hackathon);

    try {
      return await this.prisma.criterion.create({
        data: {
          hackathonId,
          name: dto.name,
          weight: dto.weight,
          position: dto.position ?? 0,
        },
        select: criterionSelect,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A criterion with this name already exists for this hackathon',
        );
      }

      throw error;
    }
  }

  async listCriteria(hackathonId: string, userId: string) {
    const hackathon = await this.requireHackathon(hackathonId);

    if (hackathon.authorId !== userId) {
      await this.requireJudge(hackathonId, userId);
    }

    return this.prisma.criterion.findMany({
      where: { hackathonId },
      orderBy: [...criterionOrder],
      select: criterionSelect,
    });
  }

  async updateCriterion(
    hackathonId: string,
    criterionId: string,
    dto: UpdateCriterionDto,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);

    if (
      dto.name === undefined &&
      dto.weight === undefined &&
      dto.position === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    this.assertRubricEditable(hackathon);

    const criterion = await this.requireCriterion(hackathonId, criterionId);

    try {
      return await this.prisma.criterion.update({
        where: { id: criterion.id },
        data: {
          name: dto.name,
          weight: dto.weight,
          position: dto.position,
        },
        select: criterionSelect,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A criterion with this name already exists for this hackathon',
        );
      }

      throw error;
    }
  }

  async deleteCriterion(
    hackathonId: string,
    criterionId: string,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);
    this.assertRubricEditable(hackathon);

    const criterion = await this.requireCriterion(hackathonId, criterionId);

    return this.prisma.criterion.delete({
      where: { id: criterion.id },
      select: criterionSelect,
    });
  }

  async assignJudge(
    hackathonId: string,
    dto: AssignJudgeDto,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${dto.userId} was not found`);
    }

    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId: dto.userId,
        },
      },
    });

    if (participant) {
      throw new BadRequestException(
        'A participant cannot be assigned as a judge for the same hackathon',
      );
    }

    if (hackathon.scoringLockedAt) {
      throw new ConflictException(
        'Scoring is locked, so the judge list cannot change',
      );
    }

    try {
      return await this.prisma.hackathonJudge.create({
        data: {
          hackathonId,
          userId: dto.userId,
        },
        select: {
          id: true,
          hackathonId: true,
          userId: true,
          assignedAt: true,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This user is already a judge for this hackathon',
        );
      }

      throw error;
    }
  }

  async listJudges(hackathonId: string, userId: string) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);

    const judges = await this.prisma.hackathonJudge.findMany({
      where: { hackathonId },
      orderBy: [{ assignedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        userId: true,
        assignedAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return judges.map((judge) => ({
      id: judge.id,
      userId: judge.userId,
      assignedAt: judge.assignedAt,
      name: judge.user.name,
    }));
  }

  async removeJudge(
    hackathonId: string,
    judgeUserId: string,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);

    const assignment = await this.prisma.hackathonJudge.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId: judgeUserId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Judge with user id ${judgeUserId} was not found for this hackathon`,
      );
    }

    if (hackathon.scoringLockedAt) {
      throw new ConflictException(
        'Scoring is locked, so the judge list cannot change',
      );
    }

    const scoreCount = await this.prisma.score.count({
      where: {
        judgeId: judgeUserId,
        project: { hackathonId },
      },
    });

    if (scoreCount > 0) {
      throw new ConflictException(
        'This judge has already scored projects and cannot be removed',
      );
    }

    await this.prisma.hackathonJudge.delete({
      where: { id: assignment.id },
    });

    return { id: assignment.id, userId: judgeUserId };
  }

  async listJudgeProjects(hackathonId: string, userId: string) {
    await this.requireHackathon(hackathonId);
    await this.requireJudge(hackathonId, userId);

    return this.prisma.project.findMany({
      where: {
        hackathonId,
        status: 'PUBLISHED',
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        repoUrl: true,
        status: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async submitScores(
    hackathonId: string,
    projectId: string,
    dto: SubmitScoresDto,
    userId: string,
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    await this.requireJudge(hackathonId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} was not found`);
    }

    if (project.hackathonId !== hackathonId) {
      throw new BadRequestException(
        'This project does not belong to this hackathon',
      );
    }

    if (!this.hasEnded(hackathon)) {
      throw new BadRequestException(
        'Scoring only opens after the hackathon end date',
      );
    }

    if (hackathon.scoringLockedAt) {
      throw new BadRequestException('Scoring is locked');
    }

    if (project.status !== 'PUBLISHED') {
      throw new BadRequestException('Only published projects can be scored');
    }

    const criteria = await this.prisma.criterion.findMany({
      where: { hackathonId },
      orderBy: [...criterionOrder],
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    if (criteria.length === 0) {
      throw new BadRequestException(
        'This hackathon has no criteria to score',
      );
    }

    this.assertCompleteScoreSet(criteria, dto);

    const judgeId = userId;
    const criterionIds = criteria.map((criterion) => criterion.id);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.score.findMany({
        where: {
          judgeId,
          projectId,
          criterionId: { in: criterionIds },
        },
        select: {
          criterionId: true,
          value: true,
        },
      });

      const existingValues = new Map(
        existing.map((score) => [score.criterionId, score.value]),
      );

      for (const item of dto.scores) {
        if (existingValues.get(item.criterionId) === item.value) {
          continue;
        }

        await tx.score.upsert({
          where: {
            judgeId_projectId_criterionId: {
              judgeId,
              projectId,
              criterionId: item.criterionId,
            },
          },
          update: { value: item.value },
          create: {
            judgeId,
            projectId,
            criterionId: item.criterionId,
            value: item.value,
          },
        });
      }
    });

    return this.buildJudgeRows(projectId, judgeId, criteria);
  }

  async getScores(hackathonId: string, projectId: string, userId: string) {
    const hackathon = await this.requireHackathon(hackathonId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        hackathonId: true,
      },
    });

    if (!project || project.hackathonId !== hackathonId) {
      throw new NotFoundException(`Project with id ${projectId} was not found`);
    }

    const isAuthor = hackathon.authorId === userId;
    const assignment = isAuthor
      ? null
      : await this.prisma.hackathonJudge.findUnique({
          where: {
            hackathonId_userId: {
              hackathonId,
              userId,
            },
          },
        });

    if (!isAuthor && !assignment) {
      throw new ForbiddenException(
        'You cannot read the scores for this project',
      );
    }

    const criteria = await this.prisma.criterion.findMany({
      where: { hackathonId },
      orderBy: [...criterionOrder],
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    const judgeIds = await this.listJudgeIds(hackathonId);

    const scores = await this.prisma.score.findMany({
      where: { projectId },
      select: {
        judgeId: true,
        criterionId: true,
        value: true,
      },
    });

    const criterionById = new Map(
      criteria.map((criterion) => [criterion.id, criterion]),
    );
    const validScores = scores.filter((score) =>
      criterionById.has(score.criterionId),
    );

    const scoresByJudge = this.groupScoresByJudge(validScores);

    const judgeTotals = judgeIds
      .map((judgeId) =>
        this.weightedScore(scoresByJudge.get(judgeId), criteria),
      )
      .filter((total): total is number => total !== null);

    const projectTotal =
      judgeTotals.length > 0
        ? this.round2(
            judgeTotals.reduce((sum, total) => sum + total, 0) /
              judgeTotals.length,
          )
        : null;

    const incomplete =
      judgeIds.length === 0 || judgeTotals.length !== judgeIds.length;

    const toRow = (score: ScoreRow) => {
      const criterion = criterionById.get(score.criterionId)!;

      return {
        criterionId: criterion.id,
        criterionName: criterion.name,
        weight: criterion.weight,
        value: score.value,
      };
    };

    if (isAuthor) {
      return {
        scores: validScores.map((score) => ({
          ...toRow(score),
          judgeId: score.judgeId,
        })),
        total: projectTotal,
        incomplete,
      };
    }

    const ownTotal = this.weightedScore(scoresByJudge.get(userId), criteria);

    return {
      scores: validScores
        .filter((score) => score.judgeId === userId)
        .map(toRow),
      total: ownTotal === null ? null : this.round2(ownTotal),
      incomplete,
    };
  }

  async lockScoring(hackathonId: string, userId: string) {
    const hackathon = await this.requireHackathon(hackathonId);
    this.requireAuthor(hackathon, userId);

    if (hackathon.scoringLockedAt) {
      return hackathon;
    }

    if (!this.hasEnded(hackathon)) {
      throw new BadRequestException(
        'Scoring can only be locked after the hackathon end date',
      );
    }

    const [criteriaCount, judgeCount] = await this.prisma.$transaction([
      this.prisma.criterion.count({ where: { hackathonId } }),
      this.prisma.hackathonJudge.count({ where: { hackathonId } }),
    ]);

    if (criteriaCount === 0) {
      throw new BadRequestException(
        'At least one criterion is required before locking scoring',
      );
    }

    if (judgeCount === 0) {
      throw new BadRequestException(
        'At least one judge is required before locking scoring',
      );
    }

    await this.prisma.hackathon.updateMany({
      where: {
        id: hackathonId,
        scoringLockedAt: null,
      },
      data: {
        scoringLockedAt: new Date(),
      },
    });

    return this.requireHackathon(hackathonId);
  }

  private assertCompleteScoreSet(
    criteria: { id: string }[],
    dto: SubmitScoresDto,
  ) {
    const criterionIds = new Set(criteria.map((criterion) => criterion.id));
    const incomingIds = new Set(
      dto.scores.map((score) => score.criterionId),
    );

    const hasEveryCriterion = criteria.every((criterion) =>
      incomingIds.has(criterion.id),
    );
    const hasNoUnknownCriterion = dto.scores.every((score) =>
      criterionIds.has(score.criterionId),
    );

    if (
      dto.scores.length !== criteria.length ||
      incomingIds.size !== dto.scores.length ||
      !hasEveryCriterion ||
      !hasNoUnknownCriterion
    ) {
      throw new BadRequestException(
        'Scores must include every criterion exactly once',
      );
    }
  }

  private async buildJudgeRows(
    projectId: string,
    judgeId: string,
    criteria: { id: string; name: string; weight: number }[],
  ) {
    const scores = await this.prisma.score.findMany({
      where: { projectId, judgeId },
      select: { criterionId: true, value: true },
    });

    const values = new Map(
      scores.map((score) => [score.criterionId, score.value]),
    );

    return criteria.map((criterion) => ({
      criterionId: criterion.id,
      criterionName: criterion.name,
      weight: criterion.weight,
      value: values.get(criterion.id) ?? null,
    }));
  }

  private groupScoresByJudge(scores: ScoreRow[]) {
    const byJudge = new Map<string, Map<string, number>>();

    for (const score of scores) {
      let values = byJudge.get(score.judgeId);

      if (!values) {
        values = new Map();
        byJudge.set(score.judgeId, values);
      }

      values.set(score.criterionId, score.value);
    }

    return byJudge;
  }

  private weightedScore(
    values: Map<string, number> | undefined,
    criteria: { id: string; weight: number }[],
  ) {
    if (!values || criteria.length === 0 || values.size !== criteria.length) {
      return null;
    }

    const totalWeight = criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0,
    );

    if (totalWeight === 0) {
      return null;
    }

    const weightedSum = criteria.reduce(
      (sum, criterion) =>
        sum + (values.get(criterion.id) ?? 0) * criterion.weight,
      0,
    );

    return weightedSum / totalWeight;
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async listJudgeIds(hackathonId: string) {
    const judges = await this.prisma.hackathonJudge.findMany({
      where: { hackathonId },
      select: { userId: true },
    });

    return judges.map((judge) => judge.userId);
  }

  private hasEnded(hackathon: { endDate: Date }) {
    return hackathon.endDate.getTime() <= Date.now();
  }

  private assertRubricEditable(hackathon: { endDate: Date }) {
    if (this.hasEnded(hackathon)) {
      throw new ConflictException(
        'The rubric is frozen because the hackathon has ended',
      );
    }
  }

  private requireAuthor(hackathon: { authorId: string }, userId: string) {
    if (hackathon.authorId !== userId) {
      throw new ForbiddenException(
        'Only the hackathon author can perform this action',
      );
    }
  }

  private async requireJudge(hackathonId: string, userId: string) {
    const assignment = await this.prisma.hackathonJudge.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'You are not an assigned judge for this hackathon',
      );
    }

    return assignment;
  }

  private async requireHackathon(hackathonId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException(
        `Hackathon with id ${hackathonId} was not found`,
      );
    }

    return hackathon;
  }

  private async requireCriterion(hackathonId: string, criterionId: string) {
    const criterion = await this.prisma.criterion.findUnique({
      where: { id: criterionId },
    });

    if (!criterion || criterion.hackathonId !== hackathonId) {
      throw new NotFoundException(
        `Criterion with id ${criterionId} was not found`,
      );
    }

    return criterion;
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
