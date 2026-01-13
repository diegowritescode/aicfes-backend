import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const requestId = (ctx.getRequest() && ctx.getRequest().requestId) || response?.locals?.requestId || null;

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        error: 'ValidationError',
        details: exception.errors,
        requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      response.status(status).json({ error: resp, requestId });
      return;
    }

    console.error('Unhandled exception', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Internal Server Error',
      requestId,
    });
  }
}

export default AllExceptionsFilter;
