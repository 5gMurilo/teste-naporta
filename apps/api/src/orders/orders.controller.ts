import type { ServerResponse } from 'node:http';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import {
  ProblemDetailsDto,
  problemJsonContent,
  ValidationProblemDetailsDto,
} from '../common/errors/problem-details.dto.js';
import { BEARER_AUTH } from '../docs/openapi.js';
import { OrderPresenter } from './dto/order.presenter.js';
import {
  type ListOrdersResponse,
  listOrdersResponseSchema,
  type OrderResponse,
  orderResponseSchema,
} from './dto/order.responses.js';
import { OrdersService } from './orders.service.js';
import { OrdersDetailReader } from './orders-detail.reader.js';
import {
  type CreateOrderRequest,
  createOrderRequestSchema,
  type ListOrdersQuery,
  listOrdersQuerySchema,
  orderParamsSchema,
  type UpdateOrderRequest,
  updateOrderRequestSchema,
} from './schemas/orders.schemas.js';

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
  constructor(
    private readonly orders: OrdersService,
    private readonly detailReader: OrdersDetailReader,
  ) {}

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

  @Get()
  @ApiResponse({
    status: 200,
    description:
      'Active orders matching every filter (AND), newest first. Pages past the end return an empty list.',
    standardSchema: listOrdersResponseSchema,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or unknown query parameters, or createdFrom after createdTo.',
    content: problemJsonContent(
      problem(400, 'Bad Request', 'VALIDATION_ERROR', 'The request is invalid.', '/api/v1/orders', {
        errors: [{ field: 'pageSize', message: 'Too big: expected number to be <=100' }],
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
  async list(
    @Query({ schema: listOrdersQuerySchema }) query: ListOrdersQuery,
  ): Promise<ListOrdersResponse> {
    const { orders, total } = await this.orders.list(query);
    return OrderPresenter.list(orders, total, query.page, query.pageSize);
  }

  @Get(':id')
  @ApiResponse({
    status: 200,
    description: 'The active order with its items and calculated total.',
    standardSchema: orderResponseSchema,
  })
  @ApiResponse({
    status: 400,
    description: 'The id is not a UUID.',
    content: problemJsonContent(
      problem(
        400,
        'Bad Request',
        'VALIDATION_ERROR',
        'The request is invalid.',
        '/api/v1/orders/123',
        {
          errors: [{ field: 'id', message: 'Invalid UUID' }],
        },
      ),
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  @ApiResponse({
    status: 404,
    description: 'The order does not exist or was deleted.',
    content: problemJsonContent(
      problem(
        404,
        'Not Found',
        'ORDER_NOT_FOUND',
        'Order not found.',
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  async detail(
    @Param({ schema: orderParamsSchema }) params: z.output<typeof orderParamsSchema>,
  ): Promise<OrderResponse> {
    return this.detailReader.read(params.id);
  }

  @Patch(':id')
  @ApiResponse({
    status: 200,
    description:
      'The updated order. Omitted fields are kept; customer, deliveryAddress, and items replace the stored value entirely.',
    standardSchema: orderResponseSchema,
  })
  @ApiResponse({
    status: 400,
    description: 'Empty body, partial customer or address, empty items, or unknown properties.',
    content: problemJsonContent(
      problem(
        400,
        'Bad Request',
        'VALIDATION_ERROR',
        'The request is invalid.',
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
        {
          errors: [{ field: 'body', message: 'At least one field is required' }],
        },
      ),
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  @ApiResponse({
    status: 404,
    description: 'The order does not exist or was deleted.',
    content: problemJsonContent(
      problem(
        404,
        'Not Found',
        'ORDER_NOT_FOUND',
        'Order not found.',
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  @ApiResponse({
    status: 409,
    description: 'The new order number is already reserved, including by a deleted order.',
    content: problemJsonContent(
      problem(
        409,
        'Conflict',
        'ORDER_NUMBER_ALREADY_EXISTS',
        'An order with this order number already exists.',
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  async patch(
    @Param({ schema: orderParamsSchema }) params: z.output<typeof orderParamsSchema>,
    @Body({ schema: updateOrderRequestSchema }) body: UpdateOrderRequest,
  ): Promise<OrderResponse> {
    return OrderPresenter.detail(await this.orders.patch(params.id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiResponse({
    status: 204,
    description: 'Order soft deleted; the response has no body. The order number stays reserved.',
  })
  @ApiResponse({
    status: 400,
    description: 'The id is not a UUID.',
    content: problemJsonContent(
      problem(
        400,
        'Bad Request',
        'VALIDATION_ERROR',
        'The request is invalid.',
        '/api/v1/orders/123',
        {
          errors: [{ field: 'id', message: 'Invalid UUID' }],
        },
      ),
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  @ApiResponse({
    status: 404,
    description: 'The order does not exist or was already deleted.',
    content: problemJsonContent(
      problem(
        404,
        'Not Found',
        'ORDER_NOT_FOUND',
        'Order not found.',
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
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
        '/api/v1/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      ),
    ),
  })
  async remove(
    @Param({ schema: orderParamsSchema }) params: z.output<typeof orderParamsSchema>,
  ): Promise<void> {
    await this.orders.delete(params.id);
  }
}
