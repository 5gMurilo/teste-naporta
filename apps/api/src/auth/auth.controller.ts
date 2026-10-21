import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProblemDetailsDto, problemJsonContent } from '../common/errors/problem-details.dto.js';
import {
  type LoginRequest,
  type LoginResponse,
  loginRequestSchema,
  loginResponseSchema,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';

const problem = (status: number, title: string, code: string, detail: string) =>
  problemJsonContent({
    type: 'about:blank',
    title,
    status,
    detail,
    instance: '/api/v1/auth/login',
    code,
    requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
  });

@ApiTags('auth')
@ApiExtraModels(ProblemDetailsDto)
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: 'Bearer token for the demo user.',
    standardSchema: loginResponseSchema,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or unknown body properties.',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
        example: {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'The request is invalid.',
          instance: '/api/v1/auth/login',
          code: 'VALIDATION_ERROR',
          requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
          errors: [{ field: 'email', message: 'Invalid email address' }],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unknown email or wrong password; both cases are indistinguishable.',
    content: problem(401, 'Unauthorized', 'INVALID_CREDENTIALS', 'Invalid email or password.'),
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
