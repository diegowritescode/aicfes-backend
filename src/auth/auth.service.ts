import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { RegisterInput } from './dto/register.schema';
import { LoginInput } from './dto/login.schema';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { normalizeTimeZone } from '../dashboard/utils/dashboard-math';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private hashPassword(password: string, salt: string) {
    return scryptSync(password, salt, 64).toString('hex');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshConfig() {
    const days = Number(this.config.get<string>('REFRESH_TOKEN_EXPIRES_DAYS') || '30');
    const cookieName = this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';
    return { days, cookieName };
  }

  private signToken(user: { id: string; email?: string | null }) {
    const secret = (this.config.get<string>('JWT_SECRET') || '') as jwt.Secret;
    const expiresIn = this.config.get<string>('JWT_EXPIRES') || '7d';
    const signOptions: jwt.SignOptions = {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    };
    return {
      token: jwt.sign({ sub: user.id, email: user.email }, secret, signOptions),
      expiresIn,
    };
  }

  private async createRefreshToken(userId: string) {
    const { days } = this.getRefreshConfig();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token: rawToken, expiresAt };
  }

  private async revokeRefreshToken(tokenHash: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findFirst({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      return {
        ok: false,
        error: {
          code: 'EMAIL_IN_USE',
          message: 'Email already registered.',
        },
      };
    }

    const salt = randomBytes(16).toString('hex');
    const hash = this.hashPassword(input.password, salt);
    const timezone = normalizeTimeZone(input.timezone);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: hash,
        passwordSalt: salt,
        timezone,
      },
      select: { id: true, email: true, timezone: true },
    });

    const tokenPayload = this.signToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      ok: true,
      data: {
        userId: user.id,
        email: user.email,
        timezone: user.timezone,
        token: tokenPayload.token,
        expiresIn: tokenPayload.expiresIn,
        tokenType: 'Bearer',
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt.toISOString(),
      },
    };
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true, passwordSalt: true, timezone: true },
    });

    if (!user || !user.passwordHash || !user.passwordSalt) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      };
    }

    const candidateHash = this.hashPassword(input.password, user.passwordSalt);
    const match = timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(user.passwordHash, 'hex'));

    if (!match) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
        },
      };
    }

    const tokenPayload = this.signToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      ok: true,
      data: {
        userId: user.id,
        email: user.email,
        timezone: user.timezone,
        token: tokenPayload.token,
        expiresIn: tokenPayload.expiresIn,
        tokenType: 'Bearer',
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt.toISOString(),
      },
    };
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashRefreshToken(rawToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true, tokenHash: true },
    });

    if (!stored) {
      return {
        ok: false,
        error: {
          code: 'INVALID_REFRESH',
          message: 'Refresh token is invalid or expired.',
        },
      };
    }

    await this.revokeRefreshToken(stored.tokenHash);
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, timezone: true },
    });

    if (!user) {
      return {
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found.',
        },
      };
    }

    const tokenPayload = this.signToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      ok: true,
      data: {
        userId: user.id,
        email: user.email,
        timezone: user.timezone,
        token: tokenPayload.token,
        expiresIn: tokenPayload.expiresIn,
        tokenType: 'Bearer',
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expiresAt.toISOString(),
      },
    };
  }
}
