import type { Logger } from 'pino';
import type { AccountRole } from '../../account/domain/account.js';
import type { AccountRepository } from '../../account/ports/account-repository.js';
import { AccountNotFoundError } from '../../shared/domain/errors.js';
import type { EventStorePort } from '../../shared/ports/event-store-port.js';
import type { DocumentType } from '../domain/kyc-verification.js';
import { KycVerification } from '../domain/kyc-verification.js';
import {
  InsufficientRoleError,
  KycVerificationNotFoundError,
} from '../domain/errors.js';
import type { KycPort } from '../ports/kyc-port.js';
import type { KycRepository } from '../ports/kyc-repository.js';

const KYC_EVENT_TYPES = {
  SUBMITTED: 'kyc.verification_submitted',
  APPROVED: 'kyc.verification_approved',
  RESUBMISSION_REQUESTED: 'kyc.resubmission_requested',
  MANUAL_REVIEW: 'kyc.sent_to_manual_review',
  REJECTED: 'kyc.verification_rejected',
  LOCKED: 'kyc.account_locked',
  UNLOCKED: 'kyc.account_unlocked',
} as const;

const ADMIN_ROLES: readonly AccountRole[] = ['administrator', 'super_administrator'];

export interface SubmitVerificationInput {
  readonly userId: string;
  readonly documentType: DocumentType;
  readonly frontDocumentRef?: string | null;
  readonly backDocumentRef?: string | null;
}

export interface KycStatusResult {
  readonly id: string;
  readonly accountId: string;
  readonly status: string;
  readonly documentType: string | null;
  readonly failureCount: number;
  readonly verifiedAt: Date | null;
  readonly submittedAt: Date | null;
}

export class KycAppService {
  constructor(
    private readonly kycRepository: KycRepository,
    private readonly accountRepository: AccountRepository,
    private readonly kycPort: KycPort,
    private readonly eventStore: EventStorePort,
    private readonly logger: Logger,
    private readonly autoApprove: boolean = true,
  ) {}

  async submitVerification(input: SubmitVerificationInput): Promise<KycStatusResult> {
    const account = await this.accountRepository.findById(input.userId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    let verification = await this.kycRepository.findByAccountId(input.userId);

    // Create a new verification record if none exists
    if (!verification) {
      verification = KycVerification.create({ accountId: input.userId });
      await this.kycRepository.save(verification);
    }

    // Submit — transitions to pending
    const submitted = verification.submit({
      documentType: input.documentType,
      frontDocumentRef: input.frontDocumentRef,
      backDocumentRef: input.backDocumentRef,
    });

    await this.kycRepository.update(submitted);

    const correlationId = crypto.randomUUID();
    const seqNum = await this.eventStore.getNextSequenceNumber(input.userId);
    await this.eventStore.append({
      eventType: KYC_EVENT_TYPES.SUBMITTED,
      aggregateId: input.userId,
      aggregateType: 'kyc_verification',
      sequenceNumber: seqNum,
      correlationId,
      sourceService: 'kyc-service',
      payload: { verificationId: submitted.id, documentType: input.documentType },
    });

    this.logger.info(
      { accountId: input.userId, verificationId: submitted.id },
      'KYC verification submitted',
    );

    // Initiate the KYC session with the provider
    const session = await this.kycPort.initiateVerification(input.userId);

    if (this.autoApprove) {
      // Mock: check status immediately and auto-approve
      const status = await this.kycPort.getVerificationStatus(session.sessionId);
      if (status === 'approved') {
        const approved = submitted.approve(session.sessionId);
        await this.kycRepository.update(approved);

        const approveSeq = await this.eventStore.getNextSequenceNumber(input.userId);
        await this.eventStore.append({
          eventType: KYC_EVENT_TYPES.APPROVED,
          aggregateId: input.userId,
          aggregateType: 'kyc_verification',
          sequenceNumber: approveSeq,
          correlationId: crypto.randomUUID(),
          sourceService: 'kyc-service',
          payload: { verificationId: approved.id, sessionId: session.sessionId },
        });

        this.logger.info(
          { accountId: input.userId, verificationId: approved.id },
          'KYC verification auto-approved (mock)',
        );

        return this.toResult(approved);
      }
    }

    return this.toResult(submitted);
  }

  async getVerificationStatus(userId: string): Promise<KycStatusResult> {
    let verification = await this.kycRepository.findByAccountId(userId);

    if (!verification) {
      // Create and return a not_verified record
      verification = KycVerification.create({ accountId: userId });
      await this.kycRepository.save(verification);
    }

    return this.toResult(verification);
  }

  async adminUnlock(adminUserId: string, targetAccountId: string): Promise<KycStatusResult> {
    // Check admin has required role
    const adminAccount = await this.accountRepository.findById(adminUserId);
    if (!adminAccount) {
      throw new AccountNotFoundError('Admin account not found.');
    }

    const isAdmin = adminAccount.roles.some((r) => ADMIN_ROLES.includes(r as AccountRole));
    if (!isAdmin) {
      throw new InsufficientRoleError(
        'Only administrators or super administrators can unlock KYC verifications.',
      );
    }

    const verification = await this.kycRepository.findByAccountId(targetAccountId);
    if (!verification) {
      throw new KycVerificationNotFoundError();
    }

    const unlocked = verification.adminUnlock();
    await this.kycRepository.update(unlocked);

    const seqNum = await this.eventStore.getNextSequenceNumber(targetAccountId);
    await this.eventStore.append({
      eventType: KYC_EVENT_TYPES.UNLOCKED,
      aggregateId: targetAccountId,
      aggregateType: 'kyc_verification',
      sequenceNumber: seqNum,
      correlationId: crypto.randomUUID(),
      sourceService: 'kyc-service',
      payload: { verificationId: unlocked.id, unlockedBy: adminUserId },
    });

    this.logger.info(
      { adminUserId, targetAccountId, verificationId: unlocked.id },
      'KYC verification unlocked by admin',
    );

    return this.toResult(unlocked);
  }

  private toResult(verification: KycVerification): KycStatusResult {
    return {
      id: verification.id,
      accountId: verification.accountId,
      status: verification.status,
      documentType: verification.documentType,
      failureCount: verification.failureCount,
      verifiedAt: verification.verifiedAt,
      submittedAt: verification.submittedAt,
    };
  }
}
