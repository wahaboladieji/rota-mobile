export const Role = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const ShiftStatus = {
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const SwapStatus = {
  PENDING_COLLEAGUE: 'PENDING_COLLEAGUE',
  PENDING_MANAGER: 'PENDING_MANAGER',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];

export const SubscriptionStatus = {
  PENDING_INITIAL_PAYMENT: 'PENDING_INITIAL_PAYMENT',
  ACTIVE: 'ACTIVE',
  GRACE: 'GRACE',
  RESTRICTED: 'RESTRICTED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const EventStatus = {
  RECEIVED: 'RECEIVED',
  QUEUED: 'QUEUED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const LedgerKind = {
  CHARGE: 'CHARGE',
  CREDIT: 'CREDIT',
  REFUND: 'REFUND',
  STATE_CHANGE: 'STATE_CHANGE',
} as const;
export type LedgerKind = (typeof LedgerKind)[keyof typeof LedgerKind];
