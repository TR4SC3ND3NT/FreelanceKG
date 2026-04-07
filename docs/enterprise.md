# Enterprise Ops Guide

## Scope
This document describes the enterprise backend layer added on top of the existing Freelance platform.

## RBAC
Roles are mapped to permissions in `server/src/lib/permissions.ts`.

- `CLIENT`: `orders.read`, `orders.write`, `proposals.read`, `messages.*`, `disputes.*`, `finance.read`, `settings.read`
- `FREELANCER`: `orders.read`, `orders.write`, `proposals.read`, `proposals.write`, `milestones.manage`, `change_requests.manage`, `messages.*`, `disputes.*`, `finance.read`, `finance.withdraw.request`, `settings.read`
- `ADMIN`: all permissions from `PERMISSIONS`

Important admin-only capabilities:
- `audit.read`
- `ledger.read`
- `cases.read`
- `cases.manage`
- `feature_flags.read`
- `feature_flags.manage`

## Feature Flags
Stored via `SystemSetting` with prefix `feature_flag:`.

Main flags:
- `escrow.enabled`
- `withdrawals.enabled`
- `disputes.enabled`
- `milestones.enabled` (default OFF)
- `change_requests.enabled` (default OFF)
- `proposals.enabled`
- `support_cases.enabled`
- `audit_panel.enabled`
- `ledger.enabled`

API:
- `GET /api/platform/flags`
- `PUT /api/platform/flags/:key`

## Idempotency
Persistent idempotency keys are stored in `IdempotencyKey`.

Header:
- `x-idempotency-key`

Protected operations:
- `POST /api/payments/withdraw`
- `POST /api/disputes/:id/resolve`
- `POST /api/admin/disputes/:id/refund-client`
- `POST /api/admin/disputes/:id/release-freelancer`

Behavior:
- same key + same scope + same payload -> replay previous response
- same key + different payload -> rejected
- in-progress key -> conflict

## Audit
Audit records are stored in `AuditLog`.

Captured fields:
- `action`
- `actorId`
- `actorRole`
- `entityType`
- `entityId`
- `ip`
- `userAgent`
- `requestId`
- `details`

Helpers:
- `auditLog(...)`
- `auditLogFromRequest(req, ...)`

Admin API:
- `GET /api/admin/audit-logs`

## Ledger
Financial accounting uses double-entry in `LedgerEntry`.

Accounts:
- `ESCROW`
- `USER_BALANCE`
- `PLATFORM_REVENUE`
- `WITHDRAWAL_HOLD`
- `WITHDRAWAL_PAID`
- `REFUND_RESERVE`

Rules:
- every batch must be balanced (`DEBIT == CREDIT`)
- every entry must include `referenceType` + `referenceId`

Admin API:
- `GET /api/admin/ledger`
- `GET /api/admin/ledger-summary`

## Support Cases
Cases are stored in `SupportCase`.

Statuses:
- `OPEN`
- `IN_PROGRESS`
- `WAITING_CUSTOMER`
- `RESOLVED`
- `CLOSED`

Priorities:
- `LOW`
- `MEDIUM`
- `HIGH`
- `URGENT`

API:
- `POST /api/cases`
- `GET /api/cases/my`
- `GET /api/cases` (permission-based)
- `PATCH /api/cases/:id/assign`
- `PATCH /api/cases/:id/status`

## Workflow (Milestones + Change Requests)
Enabled by feature flags:
- `milestones.enabled`
- `change_requests.enabled`

API base:
- `GET /api/workflow/orders/:orderId/milestones`
- `POST /api/workflow/orders/:orderId/milestones`
- `PATCH /api/workflow/milestones/:milestoneId`
- `GET /api/workflow/orders/:orderId/change-requests`
- `POST /api/workflow/orders/:orderId/change-requests`
- `PATCH /api/workflow/change-requests/:changeRequestId/respond`

## Marketplace Proposals
Proposal model is stored in `Proposal`.

API:
- `GET /api/orders/:id/proposals`
- `POST /api/orders/:id/proposals`
- `POST /api/orders/:id/proposals/:proposalId/accept`
- `POST /api/orders/:id/proposals/:proposalId/reject`

