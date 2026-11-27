import { PartialType } from '@nestjs/mapped-types';
import { CreateCriterionDto } from './create-criterion.dto.js';

export class UpdateCriterionDto extends PartialType(CreateCriterionDto) {}
