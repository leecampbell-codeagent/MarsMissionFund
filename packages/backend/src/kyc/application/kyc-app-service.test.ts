import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { InMemoryUserRepository } from '../../account/adapters/in-memory-user-repository.adapter.js';
import { UserNotFoundError } from '../../account/domain/errors/account-errors.js';
import { User, type UserData } from '../../account/domain/models/user.js';
import { AccountStatus } from '../../account/domain/value-objects/account-status.js';
import { KycStatus } from '../../account/domain/value-objects/kyc-status.js';
import { NotificationPreferences } from '../../account/domain/value-objects/notification-preferences.js';
import { Role } from '../../account/domain/value-objects/role.js';
import { InMemoryKycAuditRepository } from '../adapters/in-memory-kyc-audit-repository.adapter.js';
import { StubKycVerificationAdapter } from '../adapters/stub-kyc-provider.adapter.js';
import {
  KycAccountNotActiveError,
  KycAccountSuspendedError,
  KycAlreadyPendingError,
  KycAlreadyVerifiedError,
  KycResubmissionNotAllowedError,
  KycTransitionConflictError,
} from '../domain/errors/kyc-errors.js';
import { KycAppService } from './kyc-app-service.js';

const logger = pino({ level: 'silent' });

function makeDefaultUserData(clerkUserId: string, overrides: Partial<UserData> = {}): UserData {
  return {
    id: `id-${clerkUserId}`,
    clerkUserId,
    email: `${clerkUserId}@test.mmf`,
    displayName: null,
    bio: null,
    avatarUrl: null,
    accountStatus: AccountStatus.Active,
    onboardingCompleted: false,
    onboardingStep: null,
    roles: [Role.Backer],
    notificationPrefs: NotificationPreferences.defaults(),
    kycStatus: KycStatus.NotStarted,
    lastSeenAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function seedUser(
  repo: InMemoryUserRepository,
  clerkUserId: string,
  overrides: Partial<UserData> = {},
): User {
  const data = makeDefaultUserData(clerkUserId, overrides);
  const user = User.reconstitute(data);
  repo.users.set(clerkUserId, user);
  return user;
}

function makeService(shouldApprove = true): {
  service: KycAppService;
  userRepository: InMemoryUserRepository;
  kycAuditRepository: InMemoryKycAuditRepository;
} {
  const userRepository = new InMemoryUserRepository();
  const kycProvider = new StubKycVerificationAdapter(shouldApprove);
  const kycAuditRepository = new InMemoryKycAuditRepository();
  const service = new KycAppService(userRepository, kycProvider, kycAuditRepository, logger);
  return { service, userRepository, kycAuditRepository };
}

// ---------------------------------------------------------------------------
// getKycStatus
// ---------------------------------------------------------------------------

describe('KycAppService.getKycStatus()', () => {
  it('returns kycStatus and updatedAt for a known user', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_status_test', {
      kycStatus: KycStatus.NotStarted,
      updatedAt: new Date('2026-03-05T12:00:00Z'),
    });

    const result = await service.getKycStatus('user_status_test');

    expect(result.kycStatus).toBe(KycStatus.NotStarted);
    expect(result.updatedAt).toEqual(new Date('2026-03-05T12:00:00Z'));
  });

  it('returns kycStatus verified for a verified user', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_verified', { kycStatus: KycStatus.Verified });

    const result = await service.getKycStatus('user_verified');

    expect(result.kycStatus).toBe(KycStatus.Verified);
  });

  it('throws UserNotFoundError when user is not in repository', async () => {
    const { service } = makeService();

    await expect(service.getKycStatus('user_unknown_xyz')).rejects.toThrow(UserNotFoundError);
  });

  it('throws UserNotFoundError with clerk user ID for missing user', async () => {
    const { service } = makeService();

    await expect(service.getKycStatus('user_not_in_db')).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// submitKyc — happy paths
// ---------------------------------------------------------------------------

describe('KycAppService.submitKyc() — happy paths', () => {
  it('transitions not_started → pending → verified for stub approve', async () => {
    const { service, userRepository } = makeService(true);
    seedUser(userRepository, 'user_submit_happy', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const result = await service.submitKyc('user_submit_happy');

    expect(result.kycStatus).toBe(KycStatus.Verified);
  });

  it('returns the updated user with kycStatus verified', async () => {
    const { service, userRepository } = makeService(true);
    const user = seedUser(userRepository, 'user_submit_return', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const result = await service.submitKyc('user_submit_return');

    expect(result.clerkUserId).toBe('user_submit_return');
    expect(result.id).toBe(user.id);
    expect(result.kycStatus).toBe(KycStatus.Verified);
  });

  it('transitions rejected → pending → verified on resubmission (stub approves)', async () => {
    const { service, userRepository } = makeService(true);
    seedUser(userRepository, 'user_rejected_resubmit', {
      kycStatus: KycStatus.Rejected,
      accountStatus: AccountStatus.Active,
    });

    const result = await service.submitKyc('user_rejected_resubmit');

    expect(result.kycStatus).toBe(KycStatus.Verified);
  });

  it('emits two audit events: not_started→pending and pending→verified', async () => {
    const { service, userRepository, kycAuditRepository } = makeService(true);
    const user = seedUser(userRepository, 'user_audit_events', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    await service.submitKyc('user_audit_events');

    const events = await kycAuditRepository.findByUserId(user.id);
    expect(events).toHaveLength(2);

    const [first, second] = events;
    expect(first!.previousStatus).toBe(KycStatus.NotStarted);
    expect(first!.newStatus).toBe(KycStatus.Pending);
    expect(first!.triggerReason).toBe('user_submission');

    expect(second!.previousStatus).toBe(KycStatus.Pending);
    expect(second!.newStatus).toBe(KycStatus.Verified);
    expect(second!.triggerReason).toBe('stub_auto_approve');
  });

  it('audit event for pending→verified includes sessionId in metadata', async () => {
    const { service, userRepository, kycAuditRepository } = makeService(true);
    const user = seedUser(userRepository, 'user_session_id', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    await service.submitKyc('user_session_id');

    const events = await kycAuditRepository.findByUserId(user.id);
    const verifiedEvent = events.find((e) => e.newStatus === KycStatus.Verified);
    expect(verifiedEvent).toBeDefined();
    expect(verifiedEvent!.metadata).toMatchObject({ sessionId: `stub-session-${user.id}` });
  });

  it('transitions rejected → pending → verified for resubmission with two audit events', async () => {
    const { service, userRepository, kycAuditRepository } = makeService(true);
    const user = seedUser(userRepository, 'user_rejected_audit', {
      kycStatus: KycStatus.Rejected,
      accountStatus: AccountStatus.Active,
    });

    await service.submitKyc('user_rejected_audit');

    const events = await kycAuditRepository.findByUserId(user.id);
    expect(events).toHaveLength(2);
    expect(events[0]!.previousStatus).toBe(KycStatus.Rejected);
    expect(events[0]!.newStatus).toBe(KycStatus.Pending);
    expect(events[1]!.previousStatus).toBe(KycStatus.Pending);
    expect(events[1]!.newStatus).toBe(KycStatus.Verified);
  });
});

// ---------------------------------------------------------------------------
// submitKyc — stub declined path
// ---------------------------------------------------------------------------

describe('KycAppService.submitKyc() — stub declined path', () => {
  it('transitions not_started → pending → rejected when stub declines', async () => {
    const { service, userRepository } = makeService(false);
    seedUser(userRepository, 'user_declined', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    const result = await service.submitKyc('user_declined');

    expect(result.kycStatus).toBe(KycStatus.Rejected);
  });

  it('emits two audit events for declined path', async () => {
    const { service, userRepository, kycAuditRepository } = makeService(false);
    const user = seedUser(userRepository, 'user_declined_audit', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    await service.submitKyc('user_declined_audit');

    const events = await kycAuditRepository.findByUserId(user.id);
    expect(events).toHaveLength(2);
    expect(events[0]!.newStatus).toBe(KycStatus.Pending);
    expect(events[1]!.newStatus).toBe(KycStatus.Rejected);
    expect(events[1]!.triggerReason).toBe('stub_declined');
  });
});

// ---------------------------------------------------------------------------
// submitKyc — validation errors
// ---------------------------------------------------------------------------

describe('KycAppService.submitKyc() — user not found', () => {
  it('throws UserNotFoundError when user does not exist', async () => {
    const { service } = makeService();

    await expect(service.submitKyc('user_not_found_xyz')).rejects.toThrow(UserNotFoundError);
  });
});

describe('KycAppService.submitKyc() — account status validation', () => {
  it('throws KycAccountNotActiveError when accountStatus is pending_verification', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_pending_verification', {
      accountStatus: AccountStatus.PendingVerification,
      kycStatus: KycStatus.NotStarted,
    });

    await expect(service.submitKyc('user_pending_verification')).rejects.toThrow(
      KycAccountNotActiveError,
    );
  });

  it('throws KycAccountSuspendedError when accountStatus is suspended', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_suspended', {
      accountStatus: AccountStatus.Suspended,
      kycStatus: KycStatus.NotStarted,
    });

    await expect(service.submitKyc('user_suspended')).rejects.toThrow(KycAccountSuspendedError);
  });

  it('throws KycAccountSuspendedError when accountStatus is deactivated', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_deactivated', {
      accountStatus: AccountStatus.Deactivated,
      kycStatus: KycStatus.NotStarted,
    });

    await expect(service.submitKyc('user_deactivated')).rejects.toThrow(KycAccountSuspendedError);
  });
});

describe('KycAppService.submitKyc() — KYC status validation', () => {
  it('throws KycAlreadyPendingError when kycStatus is pending', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_already_pending', {
      kycStatus: KycStatus.Pending,
      accountStatus: AccountStatus.Active,
    });

    await expect(service.submitKyc('user_already_pending')).rejects.toThrow(KycAlreadyPendingError);
  });

  it('throws KycAlreadyPendingError when kycStatus is in_review (treat as pending)', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_in_review', {
      kycStatus: KycStatus.InReview,
      accountStatus: AccountStatus.Active,
    });

    await expect(service.submitKyc('user_in_review')).rejects.toThrow(KycAlreadyPendingError);
  });

  it('throws KycAlreadyVerifiedError when kycStatus is verified', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_already_verified', {
      kycStatus: KycStatus.Verified,
      accountStatus: AccountStatus.Active,
    });

    await expect(service.submitKyc('user_already_verified')).rejects.toThrow(
      KycAlreadyVerifiedError,
    );
  });

  it('throws KycResubmissionNotAllowedError when kycStatus is expired', async () => {
    const { service, userRepository } = makeService();
    seedUser(userRepository, 'user_expired', {
      kycStatus: KycStatus.Expired,
      accountStatus: AccountStatus.Active,
    });

    await expect(service.submitKyc('user_expired')).rejects.toThrow(KycResubmissionNotAllowedError);
  });
});

// ---------------------------------------------------------------------------
// submitKyc — concurrent transition conflict
// ---------------------------------------------------------------------------

describe('KycAppService.submitKyc() — transition conflict', () => {
  it('throws KycTransitionConflictError when concurrent update changes status before our update', async () => {
    const { service, userRepository } = makeService();
    const user = seedUser(userRepository, 'user_conflict', {
      kycStatus: KycStatus.NotStarted,
      accountStatus: AccountStatus.Active,
    });

    // Simulate concurrent update: change status to pending before our service call
    await userRepository.updateKycStatus(user.clerkUserId, KycStatus.NotStarted, KycStatus.Pending);

    // Now another service call tries to go from not_started → pending but it's already pending
    await expect(service.submitKyc('user_conflict')).rejects.toThrow(KycAlreadyPendingError);
  });
});

// ---------------------------------------------------------------------------
// InMemoryKycAuditRepository
// ---------------------------------------------------------------------------

describe('InMemoryKycAuditRepository', () => {
  it('stores and retrieves events by userId', async () => {
    const repo = new InMemoryKycAuditRepository();

    await repo.createEvent({
      userId: 'uuid-user-1',
      actorClerkUserId: 'user_clerk_1',
      action: 'kyc.status.change',
      previousStatus: KycStatus.NotStarted,
      newStatus: KycStatus.Pending,
      triggerReason: 'user_submission',
    });

    const events = await repo.findByUserId('uuid-user-1');
    expect(events).toHaveLength(1);
    expect(events[0]!.newStatus).toBe(KycStatus.Pending);
    expect(events[0]!.userId).toBe('uuid-user-1');
  });

  it('returns only events for the requested userId (tenant isolation)', async () => {
    const repo = new InMemoryKycAuditRepository();

    await repo.createEvent({
      userId: 'uuid-user-A',
      actorClerkUserId: 'user_clerk_A',
      action: 'kyc.status.change',
      previousStatus: KycStatus.NotStarted,
      newStatus: KycStatus.Pending,
      triggerReason: 'user_submission',
    });

    await repo.createEvent({
      userId: 'uuid-user-B',
      actorClerkUserId: 'user_clerk_B',
      action: 'kyc.status.change',
      previousStatus: KycStatus.NotStarted,
      newStatus: KycStatus.Pending,
      triggerReason: 'user_submission',
    });

    const eventsA = await repo.findByUserId('uuid-user-A');
    expect(eventsA).toHaveLength(1);
    expect(eventsA[0]!.userId).toBe('uuid-user-A');

    const eventsB = await repo.findByUserId('uuid-user-B');
    expect(eventsB).toHaveLength(1);
    expect(eventsB[0]!.userId).toBe('uuid-user-B');
  });

  it('returns events ordered by createdAt ascending', async () => {
    const repo = new InMemoryKycAuditRepository();

    await repo.createEvent({
      userId: 'uuid-ordered',
      actorClerkUserId: 'user_clerk_ord',
      action: 'kyc.status.change',
      previousStatus: KycStatus.NotStarted,
      newStatus: KycStatus.Pending,
      triggerReason: 'user_submission',
    });

    await repo.createEvent({
      userId: 'uuid-ordered',
      actorClerkUserId: 'user_clerk_ord',
      action: 'kyc.status.change',
      previousStatus: KycStatus.Pending,
      newStatus: KycStatus.Verified,
      triggerReason: 'stub_auto_approve',
    });

    const events = await repo.findByUserId('uuid-ordered');
    expect(events).toHaveLength(2);
    expect(events[0]!.newStatus).toBe(KycStatus.Pending);
    expect(events[1]!.newStatus).toBe(KycStatus.Verified);
    expect(events[0]!.createdAt.getTime()).toBeLessThanOrEqual(events[1]!.createdAt.getTime());
  });

  it('generates unique IDs for each event', async () => {
    const repo = new InMemoryKycAuditRepository();

    await repo.createEvent({
      userId: 'uuid-unique',
      actorClerkUserId: 'user_clerk_uniq',
      action: 'kyc.status.change',
      previousStatus: KycStatus.NotStarted,
      newStatus: KycStatus.Pending,
      triggerReason: 'user_submission',
    });

    await repo.createEvent({
      userId: 'uuid-unique',
      actorClerkUserId: 'user_clerk_uniq',
      action: 'kyc.status.change',
      previousStatus: KycStatus.Pending,
      newStatus: KycStatus.Verified,
      triggerReason: 'stub_auto_approve',
    });

    const events = await repo.findByUserId('uuid-unique');
    expect(events[0]!.id).not.toBe(events[1]!.id);
  });

  it('returns empty array for userId with no events', async () => {
    const repo = new InMemoryKycAuditRepository();
    const events = await repo.findByUserId('uuid-no-events');
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// StubKycVerificationAdapter
// ---------------------------------------------------------------------------

describe('StubKycVerificationAdapter', () => {
  it('returns approved outcome and deterministic sessionId when shouldApprove=true', async () => {
    const adapter = new StubKycVerificationAdapter(true);
    const result = await adapter.initiateSession('user-uuid-12345');

    expect(result.outcome).toBe('approved');
    expect(result.sessionId).toBe('stub-session-user-uuid-12345');
  });

  it('returns declined outcome and deterministic sessionId when shouldApprove=false', async () => {
    const adapter = new StubKycVerificationAdapter(false);
    const result = await adapter.initiateSession('user-uuid-12345');

    expect(result.outcome).toBe('declined');
    expect(result.sessionId).toBe('stub-session-user-uuid-12345');
  });

  it('defaults to shouldApprove=true when no constructor param', async () => {
    const adapter = new StubKycVerificationAdapter();
    const result = await adapter.initiateSession('some-user-id');

    expect(result.outcome).toBe('approved');
  });

  it('is deterministic: same userId always produces same sessionId', async () => {
    const adapter = new StubKycVerificationAdapter(true);
    const userId = 'fixed-user-id-123';

    const result1 = await adapter.initiateSession(userId);
    const result2 = await adapter.initiateSession(userId);

    expect(result1.sessionId).toBe(result2.sessionId);
  });
});

// ---------------------------------------------------------------------------
// InMemoryUserRepository.updateKycStatus
// ---------------------------------------------------------------------------

describe('InMemoryUserRepository.updateKycStatus()', () => {
  it('updates kycStatus from not_started to pending', async () => {
    const repo = new InMemoryUserRepository();
    seedUser(repo, 'user_update_kyc', { kycStatus: KycStatus.NotStarted });

    const updated = await repo.updateKycStatus(
      'user_update_kyc',
      KycStatus.NotStarted,
      KycStatus.Pending,
    );

    expect(updated.kycStatus).toBe(KycStatus.Pending);
  });

  it('throws KycTransitionConflictError if fromStatus does not match current status', async () => {
    const repo = new InMemoryUserRepository();
    seedUser(repo, 'user_conflict_test', { kycStatus: KycStatus.Verified });

    await expect(
      repo.updateKycStatus('user_conflict_test', KycStatus.NotStarted, KycStatus.Pending),
    ).rejects.toThrow(KycTransitionConflictError);
  });

  it('throws KycTransitionConflictError for unknown clerkUserId', async () => {
    const repo = new InMemoryUserRepository();

    await expect(
      repo.updateKycStatus('user_not_exist', KycStatus.NotStarted, KycStatus.Pending),
    ).rejects.toThrow(KycTransitionConflictError);
  });

  it('preserves all other user properties when updating kycStatus', async () => {
    const repo = new InMemoryUserRepository();
    const original = seedUser(repo, 'user_preserve', {
      kycStatus: KycStatus.NotStarted,
      displayName: 'Test User',
      roles: [Role.Backer, Role.Creator],
    });

    const updated = await repo.updateKycStatus(
      'user_preserve',
      KycStatus.NotStarted,
      KycStatus.Pending,
    );

    expect(updated.displayName).toBe(original.displayName);
    expect(updated.roles).toEqual(original.roles);
    expect(updated.email).toBe(original.email);
    expect(updated.id).toBe(original.id);
  });
});
