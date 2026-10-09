export type Role = 'ADMIN' | 'USER'

/** PENDING: new signup waiting for an admin. BLOCKED: cannot log in or register. */
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  role: Role
  status: AccountStatus
  /** Set while an admin has switched self-service password reset on (open for 24 hours). */
  password_reset_until: string | null
  created_at: string
  updated_at: string
}

export type MatchStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'COMPLETED' | 'CANCELLED'

/** FIXED_FEE: a set fee per player. SHARED_COST: no fee up front; expenses are split equally after the match. */
export type CostModel = 'FIXED_FEE' | 'SHARED_COST'

export interface Match {
  id: string
  community_id: string
  title: string
  description: string | null
  match_date: string // YYYY-MM-DD
  start_time: string // HH:MM:SS
  end_time: string | null
  venue: string
  max_players: number
  registration_fee: number
  cost_model: CostModel
  registration_opens_at: string | null
  registration_closes_at: string | null
  rules: string | null
  image_path: string | null
  status: MatchStatus
  created_at: string
  updated_at: string
}

export type ListType = 'MAIN_LIST' | 'WAITING_LIST'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'WAIVED'
export type RegistrationStatus = 'ACTIVE' | 'CANCELLED'

/** A player's own registration (RLS only returns the caller's rows to non-admins). */
export interface Registration {
  id: string
  match_id: string
  user_id: string
  status: RegistrationStatus
  list_type: ListType
  list_position: number | null
  payment_status: PaymentStatus
  payment_amount: number | null
  /** Shared-cost matches: what this player owes once shares are calculated. */
  amount_due: number | null
  payment_reference: string | null
  payment_method: string | null
  payment_notes: string | null
  paid_at: string | null
  registered_at: string
  cancelled_at: string | null
}

export interface Expense {
  id: string
  match_id: string
  description: string
  category: string
  amount: number
  created_at: string
}

/** Money totals for one match (admin only). All amounts in rupees. */
export interface MatchFinancials {
  match_id: string
  cost_model: CostModel
  registration_fee: number
  main_count: number
  waiting_count: number
  paid_count: number
  unpaid_count: number
  waived_count: number
  expected: number
  collected: number
  pending: number
  refunds_due: number
  expenses_total: number
  balance: number
  projected_balance: number
  shares_calculated: boolean
  /** Expenses or the main list changed after shares were calculated. */
  shares_stale: boolean
  share_amount: number | null
  /** Total expenses / main-list players, unrounded. Null when nobody is on the main list. */
  estimated_share: number | null
}

export interface SharesResult {
  share_amount: number
  participants: number
  total_expenses: number
  surplus: number
}

/** A player as seen by an admin (includes contact details). */
export interface PlayerSummary {
  id: string
  full_name: string
  phone: string | null
  role: Role
  status: AccountStatus
  password_reset_until: string | null
  created_at: string
  registration_count: number
}

export interface RegistrationWithMatch extends Registration {
  match: Match
}

/** Admin-only view of a registration, including the player's contact details. */
export interface AdminRegistration extends Registration {
  player: { full_name: string; phone: string | null } | null
}

/** One row of the public roster: names and lists only. */
export interface RosterEntry {
  display_name: string
  list_type: ListType
  list_position: number
  is_me: boolean
}

export interface MatchCounts {
  match_id: string
  main_count: number
  waiting_count: number
}

/** Fields an admin can set on create/update. */
export interface MatchInput {
  title: string
  description: string | null
  match_date: string
  start_time: string
  end_time: string | null
  venue: string
  max_players: number
  registration_fee: number
  cost_model: CostModel
  registration_opens_at: string | null
  registration_closes_at: string | null
  rules: string | null
  image_path: string | null
}
