import type { MatchStatus } from '@/types/domain'

export const STATUS_LABEL: Record<MatchStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Registration open',
  FULL: 'Full',
  CLOSED: 'Registration closed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export interface StatusAction {
  to: MatchStatus
  label: string
  confirmTitle: string
  confirmBody: string
  destructive?: boolean
}

const OPEN: StatusAction = {
  to: 'OPEN',
  label: 'Open registration',
  confirmTitle: 'Open registration?',
  confirmBody: 'Players will be able to see this match and register.',
}
const CLOSED: StatusAction = {
  to: 'CLOSED',
  label: 'Close registration',
  confirmTitle: 'Close registration?',
  confirmBody: 'No new registrations will be accepted. Players can no longer cancel themselves.',
}
const COMPLETED: StatusAction = {
  to: 'COMPLETED',
  label: 'Mark completed',
  confirmTitle: 'Mark match as completed?',
  confirmBody: 'This cannot be undone.',
}
const CANCELLED: StatusAction = {
  to: 'CANCELLED',
  label: 'Cancel match',
  confirmTitle: 'Cancel this match?',
  confirmBody: 'This cannot be undone. Players will see the match as cancelled.',
  destructive: true,
}

// FULL is managed automatically from Phase 3 on; admins never set it directly.
const TRANSITIONS: Record<MatchStatus, StatusAction[]> = {
  DRAFT: [OPEN, CANCELLED],
  OPEN: [CLOSED, COMPLETED, CANCELLED],
  FULL: [CLOSED, COMPLETED, CANCELLED],
  CLOSED: [OPEN, COMPLETED, CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
}

export function availableStatusActions(status: MatchStatus): StatusAction[] {
  return TRANSITIONS[status]
}
