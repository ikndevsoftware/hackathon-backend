import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

const projectInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(hackathonId: string, dto: CreateProjectDto, userId: string) {
    const hackathon = await this.requireHackathon(hackathonId);

    if (!hackathon.isActive) {
      throw new BadRequestException('This hackathon is not active');
    }

    if (hackathon.endDate.getTime() <= Date.now()) {
      throw new BadRequestException('This hackathon has already ended');
    }

    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You must join this hackathon before submitting a project',
      );
    }

    try {
      return await this.prisma.project.create({
        data: {
          hackathonId,
          userId,
          title: dto.title,
          description: dto.description,
          repoUrl: dto.repoUrl,
          demoUrl: dto.demoUrl,
        },
        include: projectInclude,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You have already submitted a project for this hackathon',
        );
      }

      throw error;
    }
  }

  async findAllForHackathon(hackathonId: string) {
    await this.requireHackathon(hackathonId);

    return this.prisma.project.findMany({
      where: { hackathonId },
      orderBy: { createdAt: 'desc' },
      include: projectInclude,
    });
  }

  async findOne(
    hackathonId: string,
    projectId: string,
    userId: string,
    role?: string | string[],
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: projectInclude,
    });

    if (!project || project.hackathonId !== hackathonId) {
      throw new NotFoundException(`Project with id ${projectId} was not found`);
    }

    if (!this.isAdmin(role) && project.userId !== userId) {
      throw new ForbiddenException('You can only view your own project');
    }

    return project;
  }

  async update(
    hackathonId: string,
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
  ) {
    await this.requireEditableProject(hackathonId, projectId, userId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        title: dto.title,
        description: dto.description,
        repoUrl: dto.repoUrl,
        demoUrl: dto.demoUrl,
      },
      include: projectInclude,
    });
  }

  async publish(hackathonId: string, projectId: string, userId: string) {
    return this.setStatus(hackathonId, projectId, userId, 'PUBLISHED');
  }

  async unpublish(hackathonId: string, projectId: string, userId: string) {
    return this.setStatus(hackathonId, projectId, userId, 'DRAFT');
  }

  async remove(hackathonId: string, projectId: string, userId: string) {
    await this.requireEditableProject(hackathonId, projectId, userId);

    return this.prisma.project.delete({
      where: { id: projectId },
      include: projectInclude,
    });
  }

  private async setStatus(
    hackathonId: string,
    projectId: string,
    userId: string,
    status: 'DRAFT' | 'PUBLISHED',
  ) {
    await this.requireEditableProject(hackathonId, projectId, userId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { status },
      include: projectInclude,
    });
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

  private async requireEditableProject(
    hackathonId: string,
    projectId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { hackathon: true },
    });

    if (!project || project.hackathonId !== hackathonId) {
      throw new NotFoundException(`Project with id ${projectId} was not found`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException('You can only change your own project');
    }

    if (project.hackathon.endDate.getTime() <= Date.now()) {
      throw new BadRequestException('This hackathon has already ended');
    }

    return project;
  }

  private isAdmin(role?: string | string[]) {
    return Array.isArray(role) ? role.includes('ADMIN') : role === 'ADMIN';
  }
}
