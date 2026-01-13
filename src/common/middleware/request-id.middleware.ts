import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

export function RequestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const id = nanoid();
  req['requestId'] = id;
  res.setHeader('X-Request-Id', id);
  res.locals.requestId = id;
  next();
}

export default RequestIdMiddleware;
