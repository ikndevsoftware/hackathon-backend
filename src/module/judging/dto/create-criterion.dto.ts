import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCriterionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(100)
  weight: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
