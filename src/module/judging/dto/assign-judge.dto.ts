import { IsString, MinLength } from 'class-validator';

export class AssignJudgeDto {
  @IsString()
  @MinLength(1)
  userId: string;
}
