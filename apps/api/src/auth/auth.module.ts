import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [API_CONFIG],
      useFactory: (config: ApiConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.JWT_EXPIRES_IN,
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: config.JWT_ISSUER,
          audience: config.JWT_AUDIENCE,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
