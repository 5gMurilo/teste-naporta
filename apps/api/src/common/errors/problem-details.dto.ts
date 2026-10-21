import { ApiProperty, ApiSchema } from '@nestjs/swagger';

const EXAMPLE_REQUEST_ID = '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10';

@ApiSchema({ name: 'FieldError' })
export class FieldErrorDto {
  @ApiProperty({ example: 'email', description: 'Dotted path of the invalid field.' })
  field!: string;

  @ApiProperty({ example: 'Invalid email address', description: 'Message without input values.' })
  message!: string;
}

@ApiSchema({ name: 'ProblemDetails' })
export class ProblemDetailsDto {
  @ApiProperty({ example: 'about:blank', enum: ['about:blank'] })
  type!: string;

  @ApiProperty({ example: 'Service Unavailable', description: 'HTTP status phrase.' })
  title!: string;

  @ApiProperty({ example: 503 })
  status!: number;

  @ApiProperty({ example: 'The service is temporarily unavailable.' })
  detail!: string;

  @ApiProperty({ example: '/api/v1/health', description: 'Request path without the query string.' })
  instance!: string;

  @ApiProperty({ example: 'SERVICE_UNAVAILABLE' })
  code!: string;

  @ApiProperty({ format: 'uuid', example: EXAMPLE_REQUEST_ID })
  requestId!: string;
}

@ApiSchema({ name: 'ValidationProblemDetails' })
export class ValidationProblemDetailsDto extends ProblemDetailsDto {
  @ApiProperty({ type: () => [FieldErrorDto] })
  errors!: FieldErrorDto[];
}

export type ProblemSchemaName = 'ProblemDetails' | 'ValidationProblemDetails';

export const problemJsonContent = (
  example: Record<string, unknown>,
  schema: ProblemSchemaName = 'ProblemDetails',
) => ({
  'application/problem+json': {
    schema: { $ref: `#/components/schemas/${schema}` },
    example: { requestId: EXAMPLE_REQUEST_ID, ...example },
  },
});
