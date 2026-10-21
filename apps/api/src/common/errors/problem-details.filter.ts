import { randomUUID } from 'node:crypto';
import { type ServerResponse, STATUS_CODES } from 'node:http';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import {
  getRequestId,
  REQUEST_ID_HEADER,
  type RequestWithId,
} from '../http/request-id.middleware.js';
import { DomainError } from './domain-errors.js';
import { mapPrismaError } from './prisma-error.mapper.js';
import { type FieldError, RequestValidationException } from './validation.exception.js';

export type ProblemLogger = { error(message: string): void };

type HttpRequest = RequestWithId & { method?: string; originalUrl?: string; url?: string };

type Problem = {
  status: number;
  code: string;
  detail: string;
  errors?: FieldError[];
};

const NATIVE_CODES: Record<number, { code: string; detail: string }> = {
  400: { code: 'VALIDATION_ERROR', detail: 'The request is invalid.' },
  401: { code: 'UNAUTHORIZED', detail: 'Authentication is required or the token is invalid.' },
  503: { code: 'SERVICE_UNAVAILABLE', detail: 'The service is temporarily unavailable.' },
};

const INTERNAL: Problem = {
  status: 500,
  code: 'INTERNAL_SERVER_ERROR',
  detail: 'An unexpected error occurred.',
};

function pathOf(request: HttpRequest): string {
  return (request.originalUrl ?? request.url ?? '/').split('?')[0] || '/';
}

function toProblem(exception: unknown): Problem {
  const error = mapPrismaError(exception);
  if (error instanceof DomainError) {
    return { status: error.status, code: error.code, detail: error.detail };
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 500) return INTERNAL;
    const known = NATIVE_CODES[status];
    const problem: Problem = known
      ? { status, ...known }
      : {
          status,
          code: 'HTTP_ERROR',
          detail: STATUS_CODES[status] ?? 'The request could not be completed.',
        };
    if (status === 400) {
      problem.errors =
        error instanceof RequestValidationException
          ? error.errors
          : [{ field: 'body', message: 'The request body or parameters are invalid.' }];
    }
    return problem;
  }
  return INTERNAL;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: ProblemLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<ServerResponse>();
    const problem = toProblem(exception);
    const requestId = getRequestId(request) ?? randomUUID();
    const path = pathOf(request);

    if (problem.status >= 500) {
      this.logger.error(
        JSON.stringify({
          event: 'request_failed',
          requestId,
          method: request.method,
          route: path,
          status: problem.status,
        }),
      );
    }
    if (response.headersSent) {
      response.end();
      return;
    }

    const body = {
      type: 'about:blank',
      title: STATUS_CODES[problem.status] ?? 'Error',
      status: problem.status,
      detail: problem.detail,
      instance: path,
      code: problem.code,
      requestId,
      ...(problem.errors ? { errors: problem.errors } : {}),
    };
    response.statusCode = problem.status;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader('Content-Type', 'application/problem+json; charset=utf-8');
    response.end(JSON.stringify(body));
  }
}
