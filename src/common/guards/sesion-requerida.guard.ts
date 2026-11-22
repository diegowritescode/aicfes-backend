import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Requires a signed-in learner.
 *
 * AuthUserMiddleware only fills in req.userId when a valid token is
 * present; it never rejects, which is right for login and for the
 * public pages. The consequence was that nothing rejected anywhere:
 * POST /api/items/generate answered 201 to an anonymous request from
 * the open internet, and generate-mixed only asked for a user when the
 * caller also asked to create a study session — so omitting that one
 * flag bought unlimited free generation.
 *
 * Every endpoint that spends money on a model now sits behind this.
 * Identity is the precondition for a quota: there is no one to meter,
 * and no one to charge, until we know whose request this is.
 */
@Injectable()
export class SesionRequeridaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = typeof req?.userId === 'string' ? req.userId.trim() : '';

    if (!userId) {
      throw new UnauthorizedException({
        code: 'AUTENTICACION_REQUERIDA',
        message: 'Inicie sesión para generar preguntas.',
      });
    }

    return true;
  }
}
