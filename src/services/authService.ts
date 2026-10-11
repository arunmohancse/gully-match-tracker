import { supabase } from '@/lib/supabase'
import { AppError, toFriendlyMessage, unwrap } from '@/lib/errors'
import type { PhoneChangeRequest, Profile } from '@/types/domain'

export const authService = {
  async signUp(input: { email: string; password: string; fullName: string; phone: string }) {
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.fullName, phone: input.phone } },
    })
    if (error) throw new AppError(toFriendlyMessage(error))
  },

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new AppError(toFriendlyMessage(error))
  },

  /** Redirects to Google and back to the site root; the session is picked up from the URL on return. */
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) throw new AppError(toFriendlyMessage(error))
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new AppError(toFriendlyMessage(error))
  },

  /** Logged out: email + registered phone + new password. Works only while an admin has switched reset on. */
  async resetPasswordWithPhone(input: { email: string; phone: string; password: string }) {
    unwrap(await supabase.rpc('reset_password_with_phone', { p_email: input.email, p_phone: input.phone, p_password: input.password }))
  },

  /** Logged in: set a new password while an admin has switched reset on. No old password needed. */
  async completeOwnPasswordReset(password: string) {
    unwrap(await supabase.rpc('complete_own_password_reset', { p_password: password }))
  },

  async getProfile(userId: string): Promise<Profile | null> {
    return unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>())
  },

  /** Name only. The phone number can't be written directly: see setInitialPhone and requestPhoneChange. */
  async updateProfile(userId: string, input: { full_name: string }): Promise<Profile> {
    const data = unwrap(await supabase.from('profiles').update(input).eq('id', userId).select('*').single<Profile>())
    if (!data) throw new AppError(toFriendlyMessage(null))
    return data
  },

  /** The first phone number, allowed only while the account has none. */
  async setInitialPhone(phone: string) {
    unwrap(await supabase.rpc('set_initial_phone', { p_phone: phone }))
  },

  /** Asks an admin to change the saved number. The current number stays until an admin approves. */
  async requestPhoneChange(phone: string) {
    unwrap(await supabase.rpc('request_phone_change', { p_phone: phone }))
  },

  async cancelPhoneChange() {
    unwrap(await supabase.rpc('cancel_phone_change'))
  },

  /** The player's most recent change request (open, approved, rejected or withdrawn), if any. */
  async latestPhoneRequest(userId: string): Promise<PhoneChangeRequest | null> {
    return unwrap(
      await supabase.from('phone_change_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle<PhoneChangeRequest>(),
    )
  },
}
