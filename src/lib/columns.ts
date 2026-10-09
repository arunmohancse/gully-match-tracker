/**
 * Columns of `matches` that clients may read. `next_seq` and `created_by` are internal and the database
 * refuses them (migration 0008), so never use `select('*')` on matches.
 */
export const MATCH_COLUMNS =
  'id, community_id, title, description, match_date, start_time, end_time, venue, max_players, registration_fee, cost_model, ' +
  'registration_opens_at, registration_closes_at, rules, image_path, status, created_at, updated_at'
