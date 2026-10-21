import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { jwtModuleOptions } from './jwt-options.js';
import { LoginRateLimitGuard } from './login-rate-limit.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [API_CONFIG],
      useFactory: (config: ApiConfig) => jwtModuleOptions(config),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LoginRateLimitGuard, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [JwtModule],
})
export class AuthModule {}
