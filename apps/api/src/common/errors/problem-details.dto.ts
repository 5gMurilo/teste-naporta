import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProblemDetailsDto {
  @ApiProperty({ example: 'about:blank', enum: ['about:blank'] })
  type!: string;

  @ApiProperty({ example: 'Service Unavailable' })
  title!: string;

  @ApiProperty({ example: 503 })
  status!: number;

  @ApiProperty({ example: 'The service is temporarily unavailable.' })
  detail!: string;

  @ApiProperty({ example: '/api/v1/health', description: 'Request path without the query string.' })
  instance!: string;

  @ApiProperty({ example: 'SERVICE_UNAVAILABLE' })
  code!: string;

  @ApiProperty({ format: 'uuid', example: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10' })
  requestId!: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  errors?: { field: string; message: string }[];
}

export const problemJsonContent = (example: Record<string, unknown>) => ({
  'application/problem+json': {
    schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
    example,
  },
});
