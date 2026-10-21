import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { OrdersDetailReader } from './orders-detail.reader.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersDetailReader],
})
export class OrdersModule {}
