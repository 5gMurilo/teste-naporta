import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InvalidCredentialsError } from '../common/errors/domain-errors.js';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginRequest, LoginResponse } from './auth.schemas.js';

@Injectable()
export class AuthService {
  private unknownUserHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async login({ email, password }: LoginRequest): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
    // Verify against a throwaway hash when the user is unknown so both failures cost the same.
    const hash = user?.passwordHash ?? (await this.getUnknownUserHash());
    const matches = await argon2.verify(hash, password);
    if (!user || !matches) throw new InvalidCredentialsError();

    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { accessToken, tokenType: 'Bearer', expiresIn: this.config.JWT_EXPIRES_IN };
  }

  private getUnknownUserHash(): Promise<string> {
    this.unknownUserHash ??= argon2.hash('unknown-user-placeholder');
    return this.unknownUserHash;
  }
}
