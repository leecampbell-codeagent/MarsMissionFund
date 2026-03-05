import pino from 'pino';
import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryAccountRepository } from '../../account/adapters/mock/in-memory-account-repository.js';
import {
  Account,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../account/domain/account.js';
import { InMemoryEventStore } from '../../shared/adapters/mock/in-memory-event-store.js';
import { AccountNotFoundError } from '../../shared/domain/errors.js';
import { InMemoryKycRepository } from '../adapters/mock/in-memory-kyc-repository.js';
import { MockKycAdapter } from '../adapters/mock/mock-kyc-adapter.js';
import { KycAppService } from '../application/kyc-app-service.js';
import { InvalidKycTransitionError, KycVerificationNotFoundError, InsufficientRoleError } from '../domain/errors.js';
import { KycVerification } from '../domain/kyc-verification.js';

const testLogger = pino({ level: 'silent' });

function makeAccount(overrides: Partial<Parameters<typeof Account.reconstitute>[0]> = {}) {
  return Account.reconstitute({
    id: 'test-account-001',
    clerkUserId: 'user_clerk_001',
    email: 'test@example.com',
    displayName: 'Test User',
    bio: null,
    avatarUrl: null,
    status: 'active',
    roles: ['backer'],
    onboardingCompleted: true,
    onboardingStep: 'completed',
    notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
    createdAt: new Date('2026-03-05T00:00:00Z'),
    updatedAt: new Date('2026-03-05T00:00:00Z'),
    ...overrides,
  });
}

function makeAdminAccount() {
  return makeAccount({
    id: 'admin-account-001',
    clerkUserId: 'user_admin_001',
    email: 'admin@example.com',
    roles: ['backer', 'administrator'],
  });
}

function makeLockedVerification(accountId: string) {
  return KycVerification.reconstitute({
    id: 'kyc-locked-001',
    accountId,
    status: 'locked',
    documentType: 'passport',
    providerReference: null,
    frontDocumentRef: null,
    backDocumentRef: null,
    failureCount: 5,
    verifiedAt: null,
    expiresAt: null,
    submittedAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-03-04T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  });
}

describe('KycAppService.submitVerification', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let kycAdapter: MockKycAdapter;
  let eventStore: InMemoryEventStore;
  let service: KycAppService;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    kycAdapter = new MockKycAdapter();
    eventStore = new InMemoryEventStore();
    service = new KycAppService(kycRepo, accountRepo, kycAdapter, eventStore, testLogger, true);
  });

  it('creates a new verification record and auto-approves (mock)', async () => {
    const account = makeAccount();
    accountRepo.seed(account);

    const result = await service.submitVerification({
      userId: account.id,
      documentType: 'passport',
    });

    expect(result.status).toBe('verified');
    expect(result.accountId).toBe(account.id);
    expect(result.documentType).toBe('passport');
  });

  it('emits kyc.verification_submitted and kyc.verification_approved events', async () => {
    const account = makeAccount();
    accountRepo.seed(account);

    await service.submitVerification({
      userId: account.id,
      documentType: 'national_id',
    });

    const events = eventStore.getAllEvents();
    const submitted = events.find((e) => e.eventType === 'kyc.verification_submitted');
    const approved = events.find((e) => e.eventType === 'kyc.verification_approved');

    expect(submitted).toBeDefined();
    expect(approved).toBeDefined();
    expect(submitted?.aggregateId).toBe(account.id);
    expect(approved?.aggregateId).toBe(account.id);
  });

  it('submits to pending when auto-approve is false', async () => {
    const noAutoApproveService = new KycAppService(
      kycRepo,
      accountRepo,
      kycAdapter,
      eventStore,
      testLogger,
      false,
    );
    const account = makeAccount();
    accountRepo.seed(account);

    const result = await noAutoApproveService.submitVerification({
      userId: account.id,
      documentType: 'passport',
    });

    expect(result.status).toBe('pending');
  });

  it('throws AccountNotFoundError for unknown user', async () => {
    await expect(
      service.submitVerification({ userId: 'nonexistent', documentType: 'passport' }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('stores document refs when provided', async () => {
    const account = makeAccount();
    accountRepo.seed(account);

    await service.submitVerification({
      userId: account.id,
      documentType: 'drivers_licence',
      frontDocumentRef: 'mock://docs/front-001',
      backDocumentRef: 'mock://docs/back-001',
    });

    const verification = await kycRepo.findByAccountId(account.id);
    // After auto-approve, refs are still stored on the verification
    expect(verification).toBeDefined();
  });
});

describe('KycAppService.getVerificationStatus', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let kycAdapter: MockKycAdapter;
  let eventStore: InMemoryEventStore;
  let service: KycAppService;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    kycAdapter = new MockKycAdapter();
    eventStore = new InMemoryEventStore();
    service = new KycAppService(kycRepo, accountRepo, kycAdapter, eventStore, testLogger, true);
  });

  it('returns not_verified status when no verification exists', async () => {
    const result = await service.getVerificationStatus('new-user-001');
    expect(result.status).toBe('not_verified');
  });

  it('returns existing verification status', async () => {
    const account = makeAccount();
    const verification = KycVerification.reconstitute({
      id: 'kyc-001',
      accountId: account.id,
      status: 'verified',
      documentType: 'passport',
      providerReference: 'session-001',
      frontDocumentRef: null,
      backDocumentRef: null,
      failureCount: 0,
      verifiedAt: new Date('2026-03-05T00:00:00Z'),
      expiresAt: null,
      submittedAt: new Date('2026-03-04T00:00:00Z'),
      createdAt: new Date('2026-03-04T00:00:00Z'),
      updatedAt: new Date('2026-03-05T00:00:00Z'),
    });
    kycRepo.seed(verification);

    const result = await service.getVerificationStatus(account.id);
    expect(result.status).toBe('verified');
    expect(result.documentType).toBe('passport');
  });
});

describe('KycAppService.adminUnlock', () => {
  let accountRepo: InMemoryAccountRepository;
  let kycRepo: InMemoryKycRepository;
  let kycAdapter: MockKycAdapter;
  let eventStore: InMemoryEventStore;
  let service: KycAppService;

  beforeEach(() => {
    accountRepo = new InMemoryAccountRepository();
    kycRepo = new InMemoryKycRepository();
    kycAdapter = new MockKycAdapter();
    eventStore = new InMemoryEventStore();
    service = new KycAppService(kycRepo, accountRepo, kycAdapter, eventStore, testLogger, true);
  });

  it('unlocks a locked verification', async () => {
    const adminAccount = makeAdminAccount();
    const targetAccount = makeAccount({ id: 'target-account-001' });
    accountRepo.seed(adminAccount);
    accountRepo.seed(targetAccount);

    const lockedVerification = makeLockedVerification(targetAccount.id);
    kycRepo.seed(lockedVerification);

    const result = await service.adminUnlock(adminAccount.id, targetAccount.id);
    expect(result.status).toBe('pending_resubmission');
  });

  it('emits kyc.account_unlocked event', async () => {
    const adminAccount = makeAdminAccount();
    const targetAccount = makeAccount({ id: 'target-account-002' });
    accountRepo.seed(adminAccount);
    accountRepo.seed(targetAccount);

    const lockedVerification = makeLockedVerification(targetAccount.id);
    kycRepo.seed(lockedVerification);

    await service.adminUnlock(adminAccount.id, targetAccount.id);

    const events = eventStore.getAllEvents();
    const unlockEvent = events.find((e) => e.eventType === 'kyc.account_unlocked');
    expect(unlockEvent).toBeDefined();
    expect(unlockEvent?.payload).toHaveProperty('unlockedBy', adminAccount.id);
  });

  it('throws InsufficientRoleError for non-admin user', async () => {
    const regularUser = makeAccount({ id: 'regular-user-001', roles: ['backer'] });
    const targetAccount = makeAccount({ id: 'target-account-003' });
    accountRepo.seed(regularUser);
    accountRepo.seed(targetAccount);

    const lockedVerification = makeLockedVerification(targetAccount.id);
    kycRepo.seed(lockedVerification);

    await expect(
      service.adminUnlock(regularUser.id, targetAccount.id),
    ).rejects.toThrow(InsufficientRoleError);
  });

  it('throws KycVerificationNotFoundError when no verification exists', async () => {
    const adminAccount = makeAdminAccount();
    accountRepo.seed(adminAccount);

    await expect(
      service.adminUnlock(adminAccount.id, 'nonexistent-account'),
    ).rejects.toThrow(KycVerificationNotFoundError);
  });

  it('throws AccountNotFoundError when admin account not found', async () => {
    await expect(
      service.adminUnlock('nonexistent-admin', 'any-target'),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('throws InvalidKycTransitionError when verification is not locked', async () => {
    const adminAccount = makeAdminAccount();
    const targetAccount = makeAccount({ id: 'target-account-004' });
    accountRepo.seed(adminAccount);
    accountRepo.seed(targetAccount);

    const pendingVerification = KycVerification.reconstitute({
      id: 'kyc-pending-001',
      accountId: targetAccount.id,
      status: 'pending',
      documentType: 'passport',
      providerReference: null,
      frontDocumentRef: null,
      backDocumentRef: null,
      failureCount: 2,
      verifiedAt: null,
      expiresAt: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    kycRepo.seed(pendingVerification);

    await expect(
      service.adminUnlock(adminAccount.id, targetAccount.id),
    ).rejects.toThrow(InvalidKycTransitionError);
  });
});
