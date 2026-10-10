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

/** The one big button on the admin page: the usual next step. Nothing for finished matches. */
export function nextStepAction(status: MatchStatus): StatusAction | null {
  if (status === 'DRAFT') return OPEN
  if (status === 'OPEN' || status === 'FULL') return CLOSED
  if (status === 'CLOSED') return COMPLETED
  return null
}

/** The other, less common status changes (shown as quiet links). Cancelling is separate, in the danger zone. */
export function secondaryStatusActions(status: MatchStatus): StatusAction[] {
  const next = nextStepAction(status)
  return availableStatusActions(status)
    .filter((a) => a.to !== next?.to && !a.destructive)
    .map((a) => (a.to === 'OPEN' && status === 'CLOSED' ? { ...a, label: 'Reopen registration' } : a))
}

/** Cancelling the match, when it is still possible. */
export function cancelAction(status: MatchStatus): StatusAction | null {
  return availableStatusActions(status).find((a) => a.destructive) ?? null
}
