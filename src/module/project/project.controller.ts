import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectService } from './project.service.js';

@Controller('hackathon/:hackathonId/projects')
@UseGuards(AuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles(['PARTICIPANT'])
  @ResponseMessage('Project created successfully')
  create(
    @Param('hackathonId') hackathonId: string,
    @Body() dto: CreateProjectDto,
    @Session() session: UserSession,
  ) {
    return this.projectService.create(hackathonId, dto, session.user.id);
  }

  @Get()
  @Roles(['ADMIN'])
  findAll(@Param('hackathonId') hackathonId: string) {
    return this.projectService.findAllForHackathon(hackathonId);
  }

  @Get(':projectId')
  findOne(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Session() session: UserSession,
  ) {
    return this.projectService.findOne(
      hackathonId,
      projectId,
      session.user.id,
      session.user.role,
    );
  }

  @Patch(':projectId')
  @ResponseMessage('Project updated successfully')
  update(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Session() session: UserSession,
  ) {
    return this.projectService.update(
      hackathonId,
      projectId,
      dto,
      session.user.id,
    );
  }

  @Delete(':projectId')
  @ResponseMessage('Project deleted successfully')
  remove(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Session() session: UserSession,
  ) {
    return this.projectService.remove(
      hackathonId,
      projectId,
      session.user.id,
    );
  }

  @Post(':projectId/publish')
  @ResponseMessage('Project published successfully')
  publish(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Session() session: UserSession,
  ) {
    return this.projectService.publish(
      hackathonId,
      projectId,
      session.user.id,
    );
  }

  @Post(':projectId/unpublish')
  @ResponseMessage('Project unpublished successfully')
  unpublish(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Session() session: UserSession,
  ) {
    return this.projectService.unpublish(
      hackathonId,
      projectId,
      session.user.id,
    );
  }
}
