// Converts raw Supabase/Postgres errors into user-friendly messages.
// Database functions raise stable codes (e.g. REGISTRATION_CLOSED); anything unknown is generic.
const MESSAGES: Record<string, string> = {
  REGISTRATION_CLOSED: 'Registration is currently closed.',
  REGISTRATION_NOT_OPEN: "Registration hasn't opened yet.",
  PAYMENT_DUE: 'You have a payment that is overdue. Please pay it (the organiser will mark it as paid) before registering for another match.',
  MATCH_CANCELLED: 'This match has been cancelled.',
  MATCH_NOT_FOUND: 'This match could not be found.',
  NOT_AUTHENTICATED: 'Please log in to continue.',
  NOT_ALLOWED: "You don't have permission to do that.",
  ALREADY_REGISTERED: 'You are already registered for this match.',
  INVALID_STATUS_CHANGE: 'That change is not allowed for this match.',
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role. Ask another admin.",
  INVALID_ROLE: 'That is not a valid role.',
  USER_NOT_FOUND: 'This player could not be found.',
  MATCH_NOT_CLOSED: 'Close registration (or mark the match completed) first, so the player list is final before the cost is shared.',
  WRONG_COST_MODEL: 'This match uses a fixed fee, so there is nothing to share.',
  NO_EXPENSES: 'Add the match expenses first.',
  NO_PARTICIPANTS: 'Nobody is on the main list, so there is no one to share the cost.',
  INVALID_STEP: 'Choose a rounding of 1, 5 or 10 rupees.',
  AMOUNT_REQUIRED: 'Calculate the shares first, or enter the amount received.',
  INVALID_PAYMENT_CHANGE: 'That payment change is not allowed. Only paid registrations can be refunded.',
  INVALID_PAYMENT_STATUS: 'That is not a valid payment status.',
  INVALID_AMOUNT: 'Enter a valid amount.',
  CANCELLATION_CLOSED: 'Registration is closed, so you can no longer cancel. Please contact the organiser.',
  REGISTRATION_NOT_FOUND: 'This registration could not be found.',
  REGISTRATION_NOT_ACTIVE: 'This registration is no longer active.',
  NO_WAITING_PLAYERS: 'Nobody is on the waiting list to take this spot. Cancel the registration instead.',
  MAIN_LIST_FULL: 'The main list is full. Choose a main-list player to swap out, or increase capacity.',
  INVALID_SWAP: 'That player cannot be swapped out. Refresh and try again.',
  CAPACITY_BELOW_REGISTERED: 'Maximum players cannot be lower than the number already on the main list.',
  INVALID_STATUS: 'That is not a valid account status.',
  CANNOT_CHANGE_OWN_STATUS: "You can't do that to your own account. Ask another admin.",
  ACCOUNT_NOT_ACTIVE: 'Your account is not active. Wait for an admin to approve it, or contact the organiser.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
  RESET_NOT_AVAILABLE: "Password reset isn't available for these details. Check your email and phone, or ask an admin to enable it.",
  'User is banned': 'This account has been blocked. Please contact the organiser.',
  'permission denied': "You don't have permission to do that.",
  'row-level security': "You don't have permission to do that.",
  'Invalid login credentials': 'Incorrect email or password.',
  'User already registered': 'An account with this email already exists.',
  'Email not confirmed': 'Please confirm your email before logging in.',
}

const GENERIC = 'Something went wrong. Please try again.'
const NETWORK = 'Network problem. Check your connection and try again.'
const NETWORK_PATTERN = /failed to fetch|networkerror|network request failed|load failed|abort|timeout|timed out/i

export class AppError extends Error {}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message: unknown }).message)
  return ''
}

/** True for connection problems and timeouts (as opposed to an answer from the server). */
export function isNetworkError(error: unknown): boolean {
  return NETWORK_PATTERN.test(rawMessage(error))
}

export function toFriendlyMessage(error: unknown): string {
  const raw = rawMessage(error)
  if (error instanceof AppError) return raw
  if (isNetworkError(error)) return NETWORK
  for (const [key, message] of Object.entries(MESSAGES)) {
    if (raw.includes(key)) return message
  }
  return GENERIC
}

/** Throws an AppError with a friendly message; use inside services. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new AppError(toFriendlyMessage(result.error))
  return result.data
}
