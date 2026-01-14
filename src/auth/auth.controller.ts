import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterSchema } from './dto/register.schema';
import { LoginSchema } from './dto/login.schema';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private authService: AuthService, private config: ConfigService) {}

  private parseCookie(req: Request, name: string) {
    const header = req.headers.cookie;
    if (!header) {
      return null;
    }
    const parts = header.split(';').map((part) => part.trim());
    for (const part of parts) {
      if (part.startsWith(`${name}=`)) {
        return decodeURIComponent(part.slice(name.length + 1));
      }
    }
    return null;
  }

  private setRefreshCookie(res: Response, token: string, expiresAtIso: string) {
    const cookieName = this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';
    const expiresAt = new Date(expiresAtIso);
    const isProd = (this.config.get<string>('NODE_ENV') || 'development') === 'production';
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      expires: expiresAt,
      path: '/api/auth',
    });
  }

  private setAccessCookie(res: Response, token: string, expiresIn: string) {
    const cookieName = this.config.get<string>('ACCESS_COOKIE_NAME') || 'access_token';
    const isProd = (this.config.get<string>('NODE_ENV') || 'development') === 'production';
    const maxAgeSeconds = this.parseExpiresInSeconds(expiresIn);
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: maxAgeSeconds * 1000,
      path: '/',
    });
  }

  private parseExpiresInSeconds(expiresIn: string) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60;
    }
    const value = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        timezone: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User created.' })
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid register payload.',
          details: parsed.error.errors,
        },
        meta: {},
      };
    }

    const result = await this.authService.register(parsed.data);
    if (!result.ok) {
      return {
        ...result,
        meta: {},
      };
    }

    this.setRefreshCookie(res, result.data.refreshToken, result.data.refreshTokenExpiresAt);
    this.setAccessCookie(res, result.data.token, result.data.expiresIn);

    return {
      ok: true,
      data: {
        userId: result.data.userId,
        email: result.data.email,
        timezone: result.data.timezone,
        token: result.data.token,
        tokenType: result.data.tokenType,
        expiresIn: result.data.expiresIn,
      },
      meta: {},
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User authenticated.' })
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login payload.',
          details: parsed.error.errors,
        },
        meta: {},
      };
    }

    const result = await this.authService.login(parsed.data);
    if (!result.ok) {
      return {
        ...result,
        meta: {},
      };
    }

    this.setRefreshCookie(res, result.data.refreshToken, result.data.refreshTokenExpiresAt);
    this.setAccessCookie(res, result.data.token, result.data.expiresIn);

    return {
      ok: true,
      data: {
        userId: result.data.userId,
        email: result.data.email,
        timezone: result.data.timezone,
        token: result.data.token,
        tokenType: result.data.tokenType,
        expiresIn: result.data.expiresIn,
      },
      meta: {},
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token issued.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';
    const refreshToken = this.parseCookie(req, cookieName);

    if (!refreshToken) {
      return {
        ok: false,
        error: {
          code: 'REFRESH_REQUIRED',
          message: 'Refresh token cookie is missing.',
        },
        meta: {},
      };
    }

    const result = await this.authService.refresh(refreshToken);
    if (!result.ok) {
      return {
        ...result,
        meta: {},
      };
    }

    this.setRefreshCookie(res, result.data.refreshToken, result.data.refreshTokenExpiresAt);
    this.setAccessCookie(res, result.data.token, result.data.expiresIn);

    return {
      ok: true,
      data: {
        userId: result.data.userId,
        email: result.data.email,
        timezone: result.data.timezone,
        token: result.data.token,
        tokenType: result.data.tokenType,
        expiresIn: result.data.expiresIn,
      },
      meta: {},
    };
  }
}
