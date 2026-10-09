import { supabase } from '@/lib/supabase'
import { AppError, toFriendlyMessage, unwrap } from '@/lib/errors'
import type { Profile } from '@/types/domain'

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

  async updateProfile(userId: string, input: { full_name: string; phone: string | null }): Promise<Profile> {
    const data = unwrap(await supabase.from('profiles').update(input).eq('id', userId).select('*').single<Profile>())
    if (!data) throw new AppError(toFriendlyMessage(null))
    return data
  },
}
