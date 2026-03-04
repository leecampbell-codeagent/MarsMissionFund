## feat-005: Campaign Creation (Draft & Submit)

**Bounded Context(s):** Campaign, Account
**Priority:** P1
**Dependencies:** feat-004, feat-013
**Estimated Complexity:** L

### Summary

Implement the campaign creation flow: guided multi-step form for project submission with draft persistence, auto-save, validation, and submission to the review queue. Covers the Draft and Submitted states of the campaign state machine. Creators must have the Creator role and verified KYC status to submit (but can draft without KYC).

### Acceptance Criteria

- [ ] Campaign creation accessible only to users with the Creator role
- [ ] Multi-step guided form: Mission Objectives (title, summary <= 280 chars, description, Mars-alignment statement), Team Credentials (at least one member), Funding (min target, max cap, deadline, budget breakdown, category), Milestone Plan (at least 2 milestones, percentages sum to 100%), Risk Disclosures (at least one), Media (hero image required)
- [ ] Campaign category single-select from the 10-category taxonomy: Propulsion, Entry Descent & Landing, Power & Energy, Habitats & Construction, Life Support & Crew Health, Food & Water Production, In-Situ Resource Utilisation, Radiation Protection, Robotics & Automation, Communications & Navigation
- [ ] Drafts auto-saved on field change (debounced)
- [ ] Creators may have multiple simultaneous drafts
- [ ] Drafts have no expiry
- [ ] On submission, full validation runs: all required fields present, funding target between $1,000,000 and $1,000,000,000 (100000000 to 100000000000 cents), milestone percentages sum to 100%, deadline between 1 week and 1 year from submission, media meets format/size requirements
- [ ] Submission blocked if creator's KYC status is not `verified` — user directed to KYC flow
- [ ] Successful submission transitions campaign to `submitted` state and sends confirmation notification
- [ ] `POST /v1/campaigns` creates a draft campaign
- [ ] `PATCH /v1/campaigns/:id` updates draft fields (only in `draft` state)
- [ ] `POST /v1/campaigns/:id/submit` validates and transitions to `submitted`
- [ ] `GET /v1/campaigns/:id` returns campaign details (scoped to creator for drafts)
- [ ] `GET /v1/campaigns?status=draft` lists creator's drafts
- [ ] All monetary values stored as BIGINT cents in database and serialised as strings in JSON
- [ ] Zod validation schemas shared between frontend and backend
- [ ] Campaign state transitions emit events to event store with audit fields
- [ ] Unit tests for campaign entity validation logic (90%+ coverage)
- [ ] Integration tests for all campaign API endpoints

### User Story

As a project creator, I want to draft and submit a campaign proposal so that it can be reviewed and approved to go live on the platform.

### Key Decisions / Open Questions

- Drafting is allowed without KYC; submission requires KYC verified
- Hero image stored via file upload (S3 adapter with local filesystem mock for dev)
- Budget breakdown is free-form text for MVP (not structured line items)
- Stretch goals are optional at submission and can be added later

### Out of Scope

- Review pipeline (feat-006)
- Campaign public page (feat-007)
- Campaign updates after going live
- Deadline extension requests
- Milestone change requests
- Appeal process
