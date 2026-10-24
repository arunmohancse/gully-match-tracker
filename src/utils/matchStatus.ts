import type { Match, MatchStatus } from '@/types/domain'
import { opensOnDay } from './registration'

export const STATUS_LABEL: Record<MatchStatus, string> = {
  DRAFT: 'Draft',
  UPCOMING: 'Registration not open yet',
  OPEN: 'Registration open',
  FULL: 'Full',
  CLOSED: 'Registration closed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** A published match whose registration has not opened yet reads "Registration not open yet" instead of "Registration open". */
export function matchStatusLabel(match: Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'>): string {
  return opensOnDay(match) ? STATUS_LABEL.UPCOMING : STATUS_LABEL[match.status]
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
/** Show the match to players with "Registration not open yet"; an admin opens registration later. */
const ANNOUNCE: StatusAction = {
  to: 'UPCOMING',
  label: 'Publish match',
  confirmTitle: 'Publish this match?',
  confirmBody: 'Players will see this match marked "Registration not open yet". They can register once you open registration.',
}
const UNPUBLISH: StatusAction = {
  to: 'DRAFT',
  label: 'Back to draft',
  confirmTitle: 'Move back to draft?',
  confirmBody: 'Players will no longer see this match until you publish it again.',
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
  DRAFT: [OPEN, ANNOUNCE, CANCELLED],
  UPCOMING: [OPEN, UNPUBLISH, CANCELLED],
  OPEN: [CLOSED, COMPLETED, CANCELLED],
  FULL: [CLOSED, COMPLETED, CANCELLED],
  CLOSED: [OPEN, COMPLETED, CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
}

export function availableStatusActions(status: MatchStatus): StatusAction[] {
  return TRANSITIONS[status]
}

/**
 * Same status change as OPEN, worded for a match whose registration opening day is still ahead:
 * it goes live now and the database holds registration back until that day.
 */
const PUBLISH_DATED: StatusAction = {
  ...OPEN,
  label: 'Publish match',
  confirmTitle: 'Publish this match?',
  confirmBody: 'Players will see this match now, but they can only register from the registration opening day.',
}

/**
 * The one big button on the admin page: the usual next step. Nothing for finished matches.
 * `opensLater` is true when the registration opening day is still in the future: a draft is then published and
 * opens by itself on that day. Without a date a draft is published as UPCOMING and an admin opens it by hand.
 */
export function nextStepAction(status: MatchStatus, opensLater = false): StatusAction | null {
  if (status === 'DRAFT') return opensLater ? PUBLISH_DATED : ANNOUNCE
  if (status === 'UPCOMING') return OPEN
  if (status === 'OPEN' || status === 'FULL') return CLOSED
  if (status === 'CLOSED') return COMPLETED
  return null
}

/**
 * The other, less common status changes (shown as quiet links). Cancelling is separate, in the danger zone.
 * A draft with a future opening day already publishes through the big button, so UPCOMING is not offered again.
 */
export function secondaryStatusActions(status: MatchStatus, opensLater = false): StatusAction[] {
  const next = nextStepAction(status, opensLater)
  return availableStatusActions(status)
    .filter((a) => a.to !== next?.to && !a.destructive && !(status === 'DRAFT' && opensLater && a.to === 'UPCOMING'))
    .map((a) => {
      if (a.to !== 'OPEN') return a
      if (status === 'CLOSED') return { ...a, label: 'Reopen registration' }
      if (status === 'DRAFT') return { ...a, label: 'Open registration now' }
      return a
    })
}

/** Cancelling the match, when it is still possible. */
export function cancelAction(status: MatchStatus): StatusAction | null {
  return availableStatusActions(status).find((a) => a.destructive) ?? null
}

/** A draft or an announced match: nobody can have registered or paid yet, so it stays out of money and dues figures. */
export function isUnopened(status: MatchStatus): boolean {
  return status === 'DRAFT' || status === 'UPCOMING'
}
