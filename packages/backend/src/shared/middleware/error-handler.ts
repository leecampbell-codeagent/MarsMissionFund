import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import {
  BioTooLongError,
  DisplayNameTooLongError,
  InvalidAvatarUrlError,
  InvalidClerkUserIdError,
  InvalidEmailError,
  SecurityAlertsCannotBeDisabledError,
  UserNotFoundError,
} from '../../account/domain/errors/account-errors.js';
import {
  KycAccountNotActiveError,
  KycAccountSuspendedError,
  KycAlreadyPendingError,
  KycAlreadyVerifiedError,
  KycResubmissionNotAllowedError,
  KycTransitionConflictError,
} from '../../kyc/domain/errors/kyc-errors.js';
import { DomainError } from '../domain/errors.js';

/**
 * Maps domain errors to HTTP status codes and API error codes.
 * WARN-002: All error responses include correlation_id.
 */
export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const correlationId = req.correlationId ?? null;

    if (err instanceof UserNotFoundError) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: "We couldn't find your account. Try signing in again.",
          correlation_id: correlationId,
        },
      });
      return;
    }

    if (
      err instanceof DisplayNameTooLongError ||
      err instanceof BioTooLongError ||
      err instanceof InvalidAvatarUrlError ||
      err instanceof InvalidEmailError
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check your input and try again.',
          correlation_id: correlationId,
        },
      });
      return;
    }

    if (err instanceof SecurityAlertsCannotBeDisabledError) {
      res.status(400).json({
        error: {
          code: 'SECURITY_ALERTS_MANDATORY',
          message: 'Security alerts are required and cannot be turned off.',
          correlation_id: correlationId,
        },
      });
      return;
    }

    if (err instanceof InvalidClerkUserIdError) {
      res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required. Sign in to continue.',
          correlation_id: correlationId,
        },
      });
      return;
    }

    // KYC 409 Conflict errors
    if (
      err instanceof KycAlreadyPendingError ||
      err instanceof KycAlreadyVerifiedError ||
      err instanceof KycResubmissionNotAllowedError ||
      err instanceof KycTransitionConflictError
    ) {
      res.status(409).json({
        error: {
          code: err.code,
          message: err.message,
          correlation_id: correlationId,
        },
      });
      return;
    }

    // KYC 403 Forbidden errors
    if (err instanceof KycAccountNotActiveError || err instanceof KycAccountSuspendedError) {
      res.status(403).json({
        error: {
          code: err.code,
          message: err.message,
          correlation_id: correlationId,
        },
      });
      return;
    }

    if (err instanceof DomainError) {
      logger.warn({ err, correlationId }, `Unhandled domain error: ${err.code}`);
      res.status(400).json({
        error: {
          code: err.code,
          message: 'The request could not be processed.',
          correlation_id: correlationId,
        },
      });
      return;
    }

    // Zod validation errors
    if (
      err &&
      typeof err === 'object' &&
      'name' in err &&
      (err as { name: string }).name === 'ZodError'
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Check your input and try again.',
          correlation_id: correlationId,
        },
      });
      return;
    }

    // Unexpected error
    logger.error({ err, correlationId }, 'Unhandled error');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: "Something went wrong on our end. We're looking into it.",
        correlation_id: correlationId,
      },
    });
  };
}




























