import { useState, type FormEvent } from 'react'
import { InstagramLink } from '@/components/InstagramLink'
import { PartOfParent } from '@/components/ParentBrand'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { isResetOpen, validateNewPassword } from '@/utils/password'
import { normalizePhone } from '@/utils/phone'

export function ProfilePage() {
  const { profile, session, setProfile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  if (!profile || !session) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const normalized = phone.trim() ? normalizePhone(phone) : null
    if (!fullName.trim()) return setMessage({ type: 'error', text: 'Please enter your name.' })
    if (phone.trim() && !normalized) return setMessage({ type: 'error', text: 'Enter a valid phone number.' })

    setSaving(true)
    setMessage(null)
    try {
      const updated = await authService.updateProfile(session!.user.id, { full_name: fullName.trim(), phone: normalized })
      setProfile(updated)
      setPhone(updated.phone ?? '')
      setMessage({ type: 'ok', text: 'Profile saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: toFriendlyMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={session.user.email ?? ''} disabled readOnly />
          </Field>
          <Field label="Full name" htmlFor="fullName">
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Phone (WhatsApp)" htmlFor="phone">
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <p className="text-sm text-slate-500">Role: {profile.role}</p>
          {message && (
            <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}>
              {message.text}
            </p>
          )}
          <Button type="submit" loading={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Card>
      <div className="space-y-2 pt-4 text-center md:hidden">
        <InstagramLink />
        <PartOfParent />
      </div>
      {isResetOpen(profile.password_reset_until) && <ChangePasswordCard onChanged={refreshProfile} />}
    </div>
  )
}

/** Shown only while an admin has switched "reset link" on for this account. No old password needed. */
function ChangePasswordCard({ onChanged }: { onChanged: () => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    const problem = validateNewPassword(password, confirm)
    if (problem) return setMessage({ type: 'error', text: problem })
    setSaving(true)
    setMessage(null)
    try {
      await authService.completeOwnPasswordReset(password)
      setPassword('')
      setConfirm('')
      setMessage({ type: 'ok', text: 'Password changed.' })
      await onChanged() // the admin's switch is single use, so the card disappears
    } catch (err) {
      setMessage({ type: 'error', text: toFriendlyMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="text-sm text-slate-600">An admin has allowed you to set a new password. You do not need the old one.</p>
        <Field label="New password" htmlFor="newPassword">
          <Input id="newPassword" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword">
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}>
            {message.text}
          </p>
        )}
        <Button type="submit" loading={saving}>
          {saving ? 'Saving...' : 'Change password'}
        </Button>
      </form>
    </Card>
  )
}
