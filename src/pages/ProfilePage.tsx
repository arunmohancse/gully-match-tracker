import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  if (!profile || !session) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    if (!fullName.trim()) return setMessage({ type: 'error', text: 'Please enter your name.' })

    setSaving(true)
    setMessage(null)
    try {
      setProfile(await authService.updateProfile(session!.user.id, { full_name: fullName.trim() }))
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
      <PhoneCard userId={session.user.id} phone={profile.phone} onChanged={refreshProfile} />
      <div className="space-y-2 pt-4 text-center md:hidden">
        <Link to="/about" className="block text-xs text-slate-500 hover:text-brand hover:underline">
          About us
        </Link>
        <InstagramLink />
        <PartOfParent />
      </div>
      {isResetOpen(profile.password_reset_until) && <ChangePasswordCard onChanged={refreshProfile} />}
    </div>
  )
}

/** The saved number is read-only. A different number is a request that an admin has to approve. */
function PhoneCard({ userId, phone, onChanged }: { userId: string; phone: string | null; onChanged: () => Promise<void> }) {
  const qc = useQueryClient()
  const { data: request } = useQuery({ queryKey: ['my-phone-request', userId], queryFn: () => authService.latestPhoneRequest(userId) })
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['my-phone-request', userId] })
    await onChanged() // an approved change shows up here without a reload
  }

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
      return true
    } catch (err) {
      setError(toFriendlyMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizePhone(value)
    if (!normalized) return setError('Enter a valid phone number (WhatsApp preferred).')
    if (normalized === phone) return setError('That is already your saved number.')
    if (await run(() => authService.requestPhoneChange(normalized))) {
      setEditing(false)
      setValue('')
    }
  }

  const open = request?.status === 'PENDING' ? request : null
  const rejected = request?.status === 'REJECTED'

  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">Phone (WhatsApp)</h2>
      <p className="text-base">{phone ?? 'Not added yet'}</p>
      {open && (
        <div role="status" className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Waiting for an admin to approve your new number <span className="font-medium">{open.new_phone}</span>. Until then your old number stays.
          </p>
          <Button size="sm" variant="outline" loading={busy} onClick={() => run(() => authService.cancelPhoneChange())}>
            Cancel request
          </Button>
        </div>
      )}
      {!open && rejected && !editing && <p className="text-sm text-slate-600">Your last request to change this number ({request.new_phone}) was not approved.</p>}
      {editing ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="New phone number" htmlFor="newPhone">
            <Input id="newPhone" type="tel" autoComplete="tel" placeholder="98765 43210" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">An admin has to approve the change. Your current number stays until then.</p>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {busy ? 'Sending...' : 'Send request'}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        !open && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Request a change
          </Button>
        )
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </Card>
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
