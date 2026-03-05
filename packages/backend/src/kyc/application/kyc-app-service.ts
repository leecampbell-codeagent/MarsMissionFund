import type { Logger } from 'pino';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import type { User } from '../../account/domain/models/user.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import type { UserRepository } from '../../account/ports/user-repository.port.js';
import {
  KycAccountNotActiveError,
  KycAccountSuspendedError,
  KycAlreadyPendingError,
  KycAlreadyVerifiedError,
  KycResubmissionNotAllowedError,
  KycTransitionConflictError,
} from '../domain/errors/kyc-errors.js';
import type { KycAuditRepositoryPort } from '../ports/kyc-audit-repository.port.js';
import type { KycVerificationPort } from '../ports/kyc-provider.port.js';

export class KycAppService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly kycProvider: KycVerificationPort,
    private readonly kycAuditRepository: KycAuditRepositoryPort,
    private readonly logger: Logger,
  ) {}

  /**
   * Returns the current KYC status and updatedAt for the authenticated user.
   * Called by GET /api/v1/kyc/status.
   */
  async getKycStatus(clerkUserId: string): Promise<{ kycStatus: KycStatus; updatedAt: Date }> {
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }
    return { kycStatus: user.kycStatus, updatedAt: user.updatedAt };
  }

  /**
   * Submits KYC verification for the authenticated user.
   * With the stub, transitions not_started|rejected → pending → verified synchronously.
   * Called by POST /api/v1/kyc/submit.
   */
  async submitKyc(clerkUserId: string): Promise<User> {
    // Step 1: Read current user
    const user = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!user) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Step 2: Validate account status
    if (user.accountStatus === 'pending_verification') {
      throw new KycAccountNotActiveError();
    }
    if (user.accountStatus === 'suspended' || user.accountStatus === 'deactivated') {
      throw new KycAccountSuspendedError();
    }

    // Step 3: Validate KYC status
    const currentKycStatus = user.kycStatus;
    if (currentKycStatus === KycStatus.Pending || currentKycStatus === KycStatus.InReview) {
      throw new KycAlreadyPendingError();
    }
    if (currentKycStatus === KycStatus.Verified) {
      throw new KycAlreadyVerifiedError();
    }
    if (currentKycStatus === KycStatus.Expired) {
      throw new KycResubmissionNotAllowedError();
    }
    // Valid from-states: 'not_started' and 'rejected'

    // Step 4: Capture previous status for audit trail
    const previousStatus = user.kycStatus;

    // Step 5a: Transition to pending — DB update first (G-019)
    await this.userRepository.updateKycStatus(clerkUserId, previousStatus, KycStatus.Pending);
    // KycTransitionConflictError is re-thrown from updateKycStatus if 0 rows affected

    // Step 5b: Audit event for not_started/rejected → pending (best-effort)
    try {
      await this.kycAuditRepository.createEvent({
        userId: user.id,
        actorClerkUserId: clerkUserId,
        action: 'kyc.status.change',
        previousStatus,
        newStatus: KycStatus.Pending,
        triggerReason: 'user_submission',
      });
    } catch (auditErr) {
      this.logger.error({ err: auditErr, clerkUserId }, 'Failed to write KYC audit event for pending transition');
    }

    // Step 6: Call KYC provider
    const result = await this.kycProvider.initiateSession(user.id);

    // Step 7: Handle provider outcome
    if (result.outcome === 'approved') {
      // Step 7a-i: Transition to verified — DB update first (G-019)
      try {
        await this.userRepository.updateKycStatus(clerkUserId, KycStatus.Pending, KycStatus.Verified);
      } catch (conflictErr) {
        if (conflictErr instanceof KycTransitionConflictError) {
          this.logger.warn(
            { clerkUserId },
            'KYC_TRANSITION_CONFLICT on pending → verified — unexpected in stub flow',
          );
          throw conflictErr;
        }
        throw conflictErr;
      }

      // Step 7a-ii: Audit event for pending → verified (best-effort)
      try {
        await this.kycAuditRepository.createEvent({
          userId: user.id,
          actorClerkUserId: clerkUserId,
          action: 'kyc.status.change',
          previousStatus: KycStatus.Pending,
          newStatus: KycStatus.Verified,
          triggerReason: 'stub_auto_approve',
          metadata: { sessionId: result.sessionId },
        });
      } catch (auditErr) {
        this.logger.error({ err: auditErr, clerkUserId }, 'Failed to write KYC audit event for verified transition');
      }
    } else if (result.outcome === 'declined') {
      // Transition to rejected
      await this.userRepository.updateKycStatus(clerkUserId, KycStatus.Pending, KycStatus.Rejected);

      // Audit event for pending → rejected (best-effort)
      try {
        await this.kycAuditRepository.createEvent({
          userId: user.id,
          actorClerkUserId: clerkUserId,
          action: 'kyc.status.change',
          previousStatus: KycStatus.Pending,
          newStatus: KycStatus.Rejected,
          triggerReason: 'stub_declined',
        });
      } catch (auditErr) {
        this.logger.error({ err: auditErr, clerkUserId }, 'Failed to write KYC audit event for rejected transition');
      }
    }
    // If outcome === 'pending' (future real provider): do not update beyond pending, fall through

    // Step 8: Read updated user
    const updatedUser = await this.userRepository.findByClerkUserId(clerkUserId);
    if (!updatedUser) {
      throw new UserNotFoundError(clerkUserId);
    }

    // Step 9: Return the updated user
    return updatedUser;
  }
}
