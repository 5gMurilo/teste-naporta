import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProblemDetailsDto, problemJsonContent } from '../common/errors/problem-details.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('health')
@ApiExtraModels(ProblemDetailsDto)
@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOkResponse({
    description: 'The API is running and PostgreSQL answered a real query.',
    schema: {
      type: 'object',
      required: ['status', 'database'],
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['ok'] },
        database: { type: 'string', enum: ['up'] },
      },
    },
    example: { status: 'ok', database: 'up' },
  })
  @ApiResponse({
    status: 503,
    description: 'PostgreSQL is unavailable.',
    content: problemJsonContent({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail: 'The service is temporarily unavailable.',
      instance: '/api/v1/health',
      code: 'SERVICE_UNAVAILABLE',
      requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
    }),
  })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException();
    }
    return { status: 'ok', database: 'up' } as const;
  }
}
