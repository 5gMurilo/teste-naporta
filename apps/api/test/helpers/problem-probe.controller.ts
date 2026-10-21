import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { OrderNumberAlreadyExistsError } from '../../src/common/errors/domain-errors.js';
import { ORDER_NUMBER_CONSTRAINT } from '../../src/common/errors/prisma-error.mapper.js';
import { Prisma } from '../../src/generated/prisma/client.js';

function prismaUnique(index: string) {
  return new Prisma.PrismaClientKnownRequestError('SELECT leaked FROM "Order"', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      driverAdapterError: {
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });
}

export class ProbeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller('probe')
export class ProblemProbeController {
  @Post('validate')
  validate(@Body() body: ProbeDto) {
    return body;
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException('internal forbidden detail');
  }

  @Get('unauthorized')
  unauthorized() {
    throw new UnauthorizedException('internal token detail');
  }

  @Get('unavailable')
  unavailable() {
    throw new ServiceUnavailableException('driver says connect ECONNREFUSED 10.0.0.1');
  }

  @Get('conflict')
  conflict() {
    throw new OrderNumberAlreadyExistsError();
  }

  @Get('boom')
  boom() {
    throw new Error('password=hunter2 SELECT * FROM "User" Authorization: Bearer abc');
  }

  @Get('prisma-order-conflict')
  prismaOrderConflict() {
    throw prismaUnique(ORDER_NUMBER_CONSTRAINT);
  }

  @Get('prisma-email-conflict')
  prismaEmailConflict() {
    throw prismaUnique('User_email_key');
  }
}
