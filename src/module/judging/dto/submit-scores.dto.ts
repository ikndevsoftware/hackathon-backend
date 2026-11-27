import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ScoreItemDto {
  @IsString()
  @MinLength(1)
  criterionId: string;

  @IsInt()
  @Min(1)
  @Max(10)
  value: number;
}

export class SubmitScoresDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores: ScoreItemDto[];
}
