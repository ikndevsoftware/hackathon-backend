import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export interface ValidationErrorItem {
  property: string;
  message: string;
}

function flattenErrors(
  errors: ValidationError[],
  parentProperty = '',
): ValidationErrorItem[] {
  return errors.flatMap((error) => {
    const property = parentProperty
      ? `${parentProperty}.${error.property}`
      : error.property;

    const constraintMessages = error.constraints
      ? Object.values(error.constraints)
      : [];

    const own: ValidationErrorItem[] =
      constraintMessages.length > 0
        ? [
            {
              property,
              message: constraintMessages[0] ?? 'Invalid value',
            },
          ]
        : [];

    return [...own, ...flattenErrors(error.children ?? [], property)];
  });
}

export const validationExceptionFactory = (
  errors: ValidationError[],
): BadRequestException =>
  new BadRequestException(flattenErrors(errors));
