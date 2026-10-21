import type { ServerResponse } from 'node:http';
import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ProblemDetailsDto,
  problemJsonContent,
  ValidationProblemDetailsDto,
} from '../common/errors/problem-details.dto.js';
import { BEARER_AUTH } from '../docs/openapi.js';
import { OrderPresenter } from './dto/order.presenter.js';
import { type OrderResponse, orderResponseSchema } from './dto/order.responses.js';
import { OrdersService } from './orders.service.js';
import { type CreateOrderRequest, createOrderRequestSchema } from './schemas/orders.schemas.js';

const problem = (
  status: number,
  title: string,
  code: string,
  detail: string,
  instance: string,
  extra: Record<string, unknown> = {},
) => ({ type: 'about:blank', title, status, detail, instance, code, ...extra });

@ApiTags('orders')
@ApiBearerAuth(BEARER_AUTH)
@ApiExtraModels(ProblemDetailsDto, ValidationProblemDetailsDto)
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiResponse({
    status: 201,
    description: 'Order created.',
    standardSchema: orderResponseSchema,
    headers: {
      Location: {
        description: 'Relative URL of the created order.',
        schema: { type: 'string', example: '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or unknown body properties.',
    content: problemJsonContent(
      problem(400, 'Bad Request', 'VALIDATION_ERROR', 'The request is invalid.', '/api/v1/orders', {
        errors: [{ field: 'expectedDeliveryDate', message: 'Expected a real calendar date' }],
      }),
      'ValidationProblemDetails',
    ),
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or expired bearer token.',
    content: problemJsonContent(
      problem(
        401,
        'Unauthorized',
        'UNAUTHORIZED',
        'Authentication is required or the token is invalid.',
        '/api/v1/orders',
      ),
    ),
  })
  @ApiResponse({
    status: 409,
    description: 'The order number is already reserved, including by a deleted order.',
    content: problemJsonContent(
      problem(
        409,
        'Conflict',
        'ORDER_NUMBER_ALREADY_EXISTS',
        'An order with this order number already exists.',
        '/api/v1/orders',
      ),
    ),
  })
  @ApiResponse({
    status: 500,
    description: 'Unexpected failure.',
    content: problemJsonContent(
      problem(
        500,
        'Internal Server Error',
        'INTERNAL_SERVER_ERROR',
        'An unexpected error occurred.',
        '/api/v1/orders',
      ),
    ),
  })
  async create(
    @Body({ schema: createOrderRequestSchema }) body: CreateOrderRequest,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<OrderResponse> {
    const order = await this.orders.create(body);
    response.setHeader('Location', `/api/v1/orders/${order.id}`);
    return OrderPresenter.detail(order);
  }
}
