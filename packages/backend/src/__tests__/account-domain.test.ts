import { describe, it, expect } from 'vitest';
import { Account, InvalidAccountDataError } from '../account/domain/account.js';
import {
  AuthenticationError,
  AccountSuspendedError,
  AccountDeletedError,
  DomainError,
} from '../shared/domain/errors.js';

describe('Account entity', () => {
  describe('create()', () => {
    it('creates an account with valid input and correct defaults', () => {
      const account = Account.create({
        clerkUserId: 'user_2xaB3cDeFgH',
        email: 'pioneer@marsmission.fund',
        displayName: 'Jane Pioneer',
      });

      expect(account.id).toBeDefined();
      expect(account.id.length).toBeGreaterThan(0);
      expect(account.clerkUserId).toBe('user_2xaB3cDeFgH');
      expect(account.email).toBe('pioneer@marsmission.fund');
      expect(account.displayName).toBe('Jane Pioneer');
      expect(account.status).toBe('active');
      expect(account.roles).toEqual(['backer']);
      expect(account.onboardingCompleted).toBe(false);
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });

    it('normalises email to lowercase', () => {
      const account = Account.create({
        clerkUserId: 'user_2xaB3cDeFgH',
        email: 'Pioneer@MarsMission.Fund',
      });

      expect(account.email).toBe('pioneer@marsmission.fund');
    });

    it('accepts null display name', () => {
      const account = Account.create({
        clerkUserId: 'user_2xaB3cDeFgH',
        email: 'pioneer@marsmission.fund',
        displayName: null,
      });

      expect(account.displayName).toBeNull();
    });

    it('defaults display name to null when not provided', () => {
      const account = Account.create({
        clerkUserId: 'user_2xaB3cDeFgH',
        email: 'pioneer@marsmission.fund',
      });

      expect(account.displayName).toBeNull();
    });

    it('throws InvalidAccountDataError for empty clerkUserId', () => {
      expect(() =>
        Account.create({
          clerkUserId: '',
          email: 'pioneer@marsmission.fund',
        }),
      ).toThrow(InvalidAccountDataError);
    });

    it('throws InvalidAccountDataError for whitespace-only clerkUserId', () => {
      expect(() =>
        Account.create({
          clerkUserId: '   ',
          email: 'pioneer@marsmission.fund',
        }),
      ).toThrow(InvalidAccountDataError);
    });

    it('throws InvalidAccountDataError for empty email', () => {
      expect(() =>
        Account.create({
          clerkUserId: 'user_2xaB3cDeFgH',
          email: '',
        }),
      ).toThrow(InvalidAccountDataError);
    });

    it('throws InvalidAccountDataError for whitespace-only email', () => {
      expect(() =>
        Account.create({
          clerkUserId: 'user_2xaB3cDeFgH',
          email: '   ',
        }),
      ).toThrow(InvalidAccountDataError);
    });

    it('InvalidAccountDataError has correct code', () => {
      try {
        Account.create({
          clerkUserId: '',
          email: 'pioneer@marsmission.fund',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidAccountDataError);
        expect(error).toBeInstanceOf(DomainError);
        expect((error as DomainError).code).toBe('INVALID_ACCOUNT_DATA');
      }
    });
  });

  describe('reconstitute()', () => {
    it('reconstitutes from raw data without validation', () => {
      const now = new Date();
      const account = Account.reconstitute({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        clerkUserId: 'user_2xaB3cDeFgH',
        email: 'pioneer@marsmission.fund',
        displayName: 'Jane Pioneer',
        status: 'suspended',
        roles: ['backer', 'creator'],
        onboardingCompleted: true,
        createdAt: now,
        updatedAt: now,
      });

      expect(account.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(account.clerkUserId).toBe('user_2xaB3cDeFgH');
      expect(account.email).toBe('pioneer@marsmission.fund');
      expect(account.displayName).toBe('Jane Pioneer');
      expect(account.status).toBe('suspended');
      expect(account.roles).toEqual(['backer', 'creator']);
      expect(account.onboardingCompleted).toBe(true);
      expect(account.createdAt).toBe(now);
      expect(account.updatedAt).toBe(now);
    });

    it('does not validate on reconstitution (allows any data from DB)', () => {
      const now = new Date();
      // This would fail create() validation but should pass reconstitute()
      const account = Account.reconstitute({
        id: 'some-id',
        clerkUserId: '',
        email: '',
        displayName: null,
        status: 'active',
        roles: [],
        onboardingCompleted: false,
        createdAt: now,
        updatedAt: now,
      });

      expect(account.clerkUserId).toBe('');
      expect(account.email).toBe('');
      expect(account.roles).toEqual([]);
    });
  });

  describe('isActive()', () => {
    it('returns true for active status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'active',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isActive()).toBe(true);
    });

    it('returns false for suspended status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'suspended',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isActive()).toBe(false);
    });

    it('returns false for pending_verification status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'pending_verification',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isActive()).toBe(false);
    });
  });

  describe('isSuspended()', () => {
    it('returns true for suspended status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'suspended',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isSuspended()).toBe(true);
    });

    it('returns true for deactivated status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'deactivated',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isSuspended()).toBe(true);
    });

    it('returns false for active status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'active',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isSuspended()).toBe(false);
    });

    it('returns false for deleted status', () => {
      const account = Account.reconstitute({
        id: 'id-1',
        clerkUserId: 'user_abc',
        email: 'test@example.com',
        displayName: null,
        status: 'deleted',
        roles: ['backer'],
        onboardingCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(account.isSuspended()).toBe(false);
    });
  });
});

describe('Domain errors', () => {
  it('AuthenticationError has code UNAUTHENTICATED', () => {
    const error = new AuthenticationError();
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.message).toBe('Authentication required.');
    expect(error.name).toBe('AuthenticationError');
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it('AuthenticationError accepts custom message', () => {
    const error = new AuthenticationError('Custom auth message');
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.message).toBe('Custom auth message');
  });

  it('AccountSuspendedError has code ACCOUNT_SUSPENDED', () => {
    const error = new AccountSuspendedError();
    expect(error.code).toBe('ACCOUNT_SUSPENDED');
    expect(error.message).toBe('Your account has been suspended. Please contact support.');
    expect(error.name).toBe('AccountSuspendedError');
    expect(error).toBeInstanceOf(DomainError);
  });

  it('AccountDeletedError has code ACCOUNT_DELETED', () => {
    const error = new AccountDeletedError();
    expect(error.code).toBe('ACCOUNT_DELETED');
    expect(error.message).toBe('This account has been deleted.');
    expect(error.name).toBe('AccountDeletedError');
    expect(error).toBeInstanceOf(DomainError);
  });
});
