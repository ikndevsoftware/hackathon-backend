import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { ResponseMessage } from '../../common/decorators/response-message.decorator.js';
import { AssignJudgeDto } from './dto/assign-judge.dto.js';
import { CreateCriterionDto } from './dto/create-criterion.dto.js';
import { SubmitScoresDto } from './dto/submit-scores.dto.js';
import { UpdateCriterionDto } from './dto/update-criterion.dto.js';
import { JudgingService } from './judging.service.js';

@Controller('hackathon/:hackathonId')
@UseGuards(AuthGuard)
export class JudgingController {
  constructor(private readonly judgingService: JudgingService) {}

  @Post('criteria')
  @Roles(['ADMIN'])
  @ResponseMessage('Criterion created successfully')
  createCriterion(
    @Param('hackathonId') hackathonId: string,
    @Body() dto: CreateCriterionDto,
    @Session() session: UserSession,
  ) {
    return this.judgingService.createCriterion(
      hackathonId,
      dto,
      session.user.id,
    );
  }

  @Get('criteria')
  listCriteria(
    @Param('hackathonId') hackathonId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.listCriteria(hackathonId, session.user.id);
  }

  @Patch('criteria/:criterionId')
  @Roles(['ADMIN'])
  @ResponseMessage('Criterion updated successfully')
  updateCriterion(
    @Param('hackathonId') hackathonId: string,
    @Param('criterionId') criterionId: string,
    @Body() dto: UpdateCriterionDto,
    @Session() session: UserSession,
  ) {
    return this.judgingService.updateCriterion(
      hackathonId,
      criterionId,
      dto,
      session.user.id,
    );
  }

  @Delete('criteria/:criterionId')
  @Roles(['ADMIN'])
  @ResponseMessage('Criterion deleted successfully')
  deleteCriterion(
    @Param('hackathonId') hackathonId: string,
    @Param('criterionId') criterionId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.deleteCriterion(
      hackathonId,
      criterionId,
      session.user.id,
    );
  }

  @Post('judges')
  @Roles(['ADMIN'])
  @ResponseMessage('Judge assigned successfully')
  assignJudge(
    @Param('hackathonId') hackathonId: string,
    @Body() dto: AssignJudgeDto,
    @Session() session: UserSession,
  ) {
    return this.judgingService.assignJudge(
      hackathonId,
      dto,
      session.user.id,
    );
  }

  @Get('judges')
  @Roles(['ADMIN'])
  listJudges(
    @Param('hackathonId') hackathonId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.listJudges(hackathonId, session.user.id);
  }

  @Delete('judges/:userId')
  @Roles(['ADMIN'])
  @ResponseMessage('Judge removed successfully')
  removeJudge(
    @Param('hackathonId') hackathonId: string,
    @Param('userId') judgeUserId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.removeJudge(
      hackathonId,
      judgeUserId,
      session.user.id,
    );
  }

  @Get('judging/projects')
  listJudgeProjects(
    @Param('hackathonId') hackathonId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.listJudgeProjects(
      hackathonId,
      session.user.id,
    );
  }

  @Put('projects/:projectId/scores')
  @ResponseMessage('Scores submitted successfully')
  submitScores(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Body() dto: SubmitScoresDto,
    @Session() session: UserSession,
  ) {
    return this.judgingService.submitScores(
      hackathonId,
      projectId,
      dto,
      session.user.id,
    );
  }

  @Get('projects/:projectId/scores')
  getScores(
    @Param('hackathonId') hackathonId: string,
    @Param('projectId') projectId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.getScores(
      hackathonId,
      projectId,
      session.user.id,
    );
  }

  @Post('lock-scoring')
  @Roles(['ADMIN'])
  @ResponseMessage('Scoring locked successfully')
  lockScoring(
    @Param('hackathonId') hackathonId: string,
    @Session() session: UserSession,
  ) {
    return this.judgingService.lockScoring(hackathonId, session.user.id);
  }
}
