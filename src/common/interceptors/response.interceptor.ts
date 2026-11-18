import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator.js';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

const AUTH_BASE_PATH = '/api/auth';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ originalUrl?: string; url?: string }>();

    const path = request.originalUrl ?? request.url ?? '';
    if (path.startsWith(AUTH_BASE_PATH)) {
      return next.handle();
    }

    const response = context
      .switchToHttp()
      .getResponse<{ statusCode: number }>();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Success';

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        message,
        data: data ?? null,
      })),
    );
  }
}
