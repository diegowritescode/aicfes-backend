import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export function AuthUserMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | null = null;

  if (authHeader && typeof authHeader === 'string') {
    const [scheme, raw] = authHeader.split(' ');
    if (scheme === 'Bearer' && raw) {
      token = raw;
    }
  }

  if (!token) {
    const cookieName = process.env.ACCESS_COOKIE_NAME || 'access_token';
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const parts = cookieHeader.split(';').map((part) => part.trim());
      for (const part of parts) {
        if (part.startsWith(`${cookieName}=`)) {
          token = decodeURIComponent(part.slice(cookieName.length + 1));
          break;
        }
      }
    }
  }

  if (!token) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next();
  }

  try {
    const payload = jwt.verify(token, secret) as { sub?: string };
    if (payload && payload.sub) {
      (req as any).userId = payload.sub;
    }
  } catch {
    // Ignore invalid tokens to preserve backward compatibility.
  }

  return next();
}

export default AuthUserMiddleware;
