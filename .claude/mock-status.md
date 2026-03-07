# Mock Adapter Status

> Tracks which external service adapters are mocked vs real.

| Service | Adapter | Status | Feature | Notes |
|---------|---------|--------|---------|-------|
| Clerk | Auth | Real (with MOCK_AUTH=true fallback for tests) | feat-002 | ClerkAuthAdapter + MockAuthAdapter implemented |
| Stripe | Payments | Mock (stub) | feat-010 | Not yet implemented |
| Veriff | KYC | Mock (auto-approve) | feat-007 | Not yet implemented |
| AWS SES | Email | Mock (log only) | feat-014 | Not yet implemented |
| PostHog | Feature flags | Real | feat-001 | posthog-node configured |
