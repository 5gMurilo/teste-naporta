import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import {
  ProblemDetailsDto,
  problemJsonContent,
  ValidationProblemDetailsDto,
} from '../common/errors/problem-details.dto.js';
import {
  type LoginRequest,
  type LoginResponse,
  loginRequestSchema,
  loginResponseSchema,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';

const problem = (status: number, title: string, code: string, detail: string) =>
  problemJsonContent({
    type: 'about:blank',
    title,
    status,
    detail,
    instance: '/api/v1/auth/login',
    code,
  });

@Public()
@ApiTags('auth')
@ApiExtraModels(ProblemDetailsDto, ValidationProblemDetailsDto)
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: 'Bearer token for the demo user.',
    standardSchema: loginResponseSchema,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or unknown body properties.',
    content: problemJsonContent(
      {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'The request is invalid.',
        instance: '/api/v1/auth/login',
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'email', message: 'Invalid email address' }],
      },
      'ValidationProblemDetails',
    ),
  })
  @ApiResponse({
    status: 401,
    description: 'Unknown email or wrong password; both cases are indistinguishable.',
    content: problem(401, 'Unauthorized', 'INVALID_CREDENTIALS', 'Invalid email or password.'),
  })
  @ApiResponse({
    status: 429,
    description:
      'Too many login attempts from this client address in the current window (default 5 per 60 seconds).',
    headers: {
      'Retry-After': {
        description: 'Seconds until the client may try again.',
        schema: { type: 'integer', minimum: 1, example: 42 },
      },
    },
    content: problem(429, 'Too Many Requests', 'HTTP_ERROR', 'Too many login attempts.'),
  })
  @ApiResponse({
    status: 500,
    description: 'Unexpected failure.',
    content: problem(
      500,
      'Internal Server Error',
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred.',
    ),
  })
  login(@Body({ schema: loginRequestSchema }) body: LoginRequest): Promise<LoginResponse> {
    return this.auth.login(body);
  }
}
