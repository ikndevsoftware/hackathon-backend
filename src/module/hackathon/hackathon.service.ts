import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../lib/database/prisma.service.js';
import { CreateHackathonDto } from './dto/create-hackathon.dto.js';
import { UpdateHackathonDto } from './dto/update-hackathon.dto.js';

const hackathonInclude = {
  author: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      participants: true,
    },
  },
} as const;

@Injectable()
export class HackathonService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateHackathonDto, authorId: string) {
    return this.prisma.hackathon.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startsAt,
        endDate: dto.endsAt,
        isActive: dto.isActive ?? false,
        authorId,
      },
      include: hackathonInclude,
    });
  }

  findAll() {
    return this.prisma.hackathon.findMany({
      orderBy: { createdAt: 'desc' },
      include: hackathonInclude,
    });
  }

  async join(hackathonId: string, userId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException(
        `Hackathon with id ${hackathonId} was not found`,
      );
    }

    if (!hackathon.isActive) {
      throw new BadRequestException('This hackathon is not active');
    }

    if (hackathon.endDate.getTime() <= Date.now()) {
      throw new BadRequestException('This hackathon has already ended');
    }

    try {
      return await this.prisma.hackathonParticipant.create({
        data: {
          hackathonId,
          userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You have already joined this hackathon',
        );
      }

      throw error;
    }
  }

  async findOne(id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
      include: hackathonInclude,
    });

    if (!hackathon) {
      throw new NotFoundException(`Hackathon with id ${id} was not found`);
    }

    return hackathon;
  }

  async update(id: string, dto: UpdateHackathonDto) {
    await this.findOne(id);

    return this.prisma.hackathon.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startsAt,
        endDate: dto.endsAt,
        isActive: dto.isActive,
      },
      include: hackathonInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.hackathon.delete({
      where: { id },
      include: hackathonInclude,
    });
  }
}
