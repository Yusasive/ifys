import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { defaultCodeForStatus, ErrorCode } from './error-codes';
import { reportException } from './monitoring';

interface ErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
}

// class-validator messages start with the property name ("email must be an
// email"), so the first word doubles as the field key.
function fieldErrorsFromMessages(
  messages: string[],
): Record<string, string> | undefined {
  const fieldErrors: Record<string, string> = {};
  for (const msg of messages) {
    const field = msg.split(' ')[0];
    if (field && !(field in fieldErrors)) fieldErrors[field] = msg;
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function toErrorBody(exception: HttpException): ErrorBody {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return {
      statusCode,
      code: defaultCodeForStatus(statusCode),
      message: response,
    };
  }
  const { message, fieldErrors, code } = response as {
    message?: string | string[];
    fieldErrors?: Record<string, string>;
    code?: ErrorCode;
  };
  if (Array.isArray(message)) {
    return {
      statusCode,
      code: code ?? ErrorCode.ValidationFailed,
      message: 'Some fields are invalid',
      fieldErrors: fieldErrors ?? fieldErrorsFromMessages(message),
    };
  }
  return {
    statusCode,
    code: code ?? defaultCodeForStatus(statusCode),
    message: message ?? exception.message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

/**
 * Gives every error the same `{ statusCode, code, message, fieldErrors? }`
 * shape (message is always a string). Server errors are logged and reported
 * with a request id that is also returned to the client, so a user's report
 * can be matched to the log entry. Unexpected errors never leak internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const requestId = req.header('x-request-id') ?? randomUUID();
    res.setHeader('x-request-id', requestId);

    if (exception instanceof HttpException) {
      const body = toErrorBody(exception);
      if (body.statusCode >= 500) {
        this.logger.error(
          `[${requestId}] ${req.method} ${req.url}: ${body.message}`,
        );
        reportException(exception, { requestId, url: req.url });
        body.requestId = requestId;
      }
      res.status(body.statusCode).json(body);
      return;
    }

    this.logger.error(
      `[${requestId}] ${req.method} ${req.url}: unhandled exception`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    reportException(exception, { requestId, url: req.url });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.Internal,
      message: 'Something went wrong on our side. Please try again.',
      requestId,
    } satisfies ErrorBody);
  }
}
