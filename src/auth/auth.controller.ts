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

  /**
   * Whether this caller can hold a cookie.
   *
   * A browser can: the refresh token goes in an httpOnly cookie, where
   * JavaScript cannot reach it, so an XSS cannot steal it. That is why
   * the token has never been in the response body.
   *
   * A native app cannot. There is no cookie jar the server can rely
   * on, so the same design left the mobile client with no way to
   * refresh at all: its session simply expired after seven days and
   * dropped the learner at the sign-in screen with no explanation.
   *
   * So the token goes in the body for native clients only, which
   * declare themselves with this header. On the phone it is stored in
   * `expo-secure-store` — the Keychain on iOS, EncryptedSharedPreferences
   * on Android — which is a stronger place than a cookie, not a weaker
   * one: the operating system encrypts it and no other app can read it.
   *
   * The header is a hint, not a credential, and it only chooses where
   * an already-issued token is written. A browser that sent it would
   * receive its own token in its own response, which it could already
   * use.
   */
  /**
   * The session payload, in one place.
   *
   * It was written out three times — register, login and refresh —
   * identically. Three copies is three places to forget a field, and
   * forgetting it here is a session that silently stops refreshing.
   */
  private cuerpoDeSesion(
    datos: {
      userId: string;
      email: string;
      timezone: string;
      token: string;
      tokenType: string;
      expiresIn: string;
      refreshToken: string;
      refreshTokenExpiresAt: string;
    },
    nativo: boolean,
  ) {
    return {
      userId: datos.userId,
      email: datos.email,
      timezone: datos.timezone,
      token: datos.token,
      tokenType: datos.tokenType,
      expiresIn: datos.expiresIn,
      /* Only for a client that cannot hold a cookie. A browser keeps
         receiving nothing here, so an XSS has nothing to read. */
      ...(nativo
        ? {
            refreshToken: datos.refreshToken,
            refreshTokenExpiresAt: datos.refreshTokenExpiresAt,
          }
        : {}),
    };
  }

  private esClienteNativo(req: Request): boolean {
    const declarado = req.headers['x-cliente'];
    const valor = Array.isArray(declarado) ? declarado[0] : declarado;
    return typeof valor === 'string' && valor.trim().toLowerCase() === 'movil';
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
  async register(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
      data: this.cuerpoDeSesion(result.data, this.esClienteNativo(req)),
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
  async login(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
      data: this.cuerpoDeSesion(result.data, this.esClienteNativo(req)),
      meta: {},
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token issued.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { refreshToken?: string },
  ) {
    const cookieName = this.config.get<string>('REFRESH_COOKIE_NAME') || 'refresh_token';
    /* The cookie first, so a browser keeps behaving exactly as before.
       The body is for native clients, which have no cookie jar: reading
       only the cookie is why the mobile app could never refresh. */
    const delCuerpo = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';
    const refreshToken = this.parseCookie(req, cookieName) || delCuerpo || null;

    if (!refreshToken) {
      return {
        ok: false,
        error: {
          code: 'REFRESH_REQUIRED',
          message: 'No llegó el refresh token: ni en la cookie ni en el cuerpo.',
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
      data: this.cuerpoDeSesion(result.data, this.esClienteNativo(req)),
      meta: {},
    };
  }
}
