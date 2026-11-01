import { HttpStatus } from '@nestjs/common';

// Stable, machine-readable error identifiers. The frontend branches on
// these instead of matching message text, so messages can be reworded freely.
export const ErrorCode = {
  FormInvalid: 'FORM_INVALID',
  ValidationFailed: 'VALIDATION_FAILED',
  PurchasingPaused: 'PURCHASING_PAUSED',
  SoldOut: 'SOLD_OUT',
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  [HttpStatus.UNAUTHORIZED]: ErrorCode.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCode.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCode.NotFound,
  [HttpStatus.CONFLICT]: ErrorCode.Conflict,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RateLimited,
};

export function defaultCodeForStatus(status: number): ErrorCode {
  return (
    CODE_BY_STATUS[status] ??
    (status >= 500 ? ErrorCode.Internal : ErrorCode.BadRequest)
  );
}
