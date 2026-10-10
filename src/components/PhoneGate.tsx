import { useState, type FormEvent } from 'react'
import { BrandLockup } from '@/components/BrandLockup'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { normalizePhone } from '@/utils/phone'

/** Shown once to accounts with no phone number (e.g. first Google sign-in). UX only; the phone is just a profile field. */
export function PhoneGate() {
  const { profile, session, setProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving || !profile || !session) return
    const normalized = normalizePhone(phone)
    if (!normalized) return setError('Enter a valid phone number (WhatsApp preferred).')
    setSaving(true)
    setError(null)
    try {
      setProfile(await authService.updateProfile(session.user.id, { full_name: profile.full_name, phone: normalized }))
    } catch (err) {
      setError(toFriendlyMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div className="flex justify-center text-brand">
          <BrandLockup large />
        </div>
        <h1 className="text-center text-xl font-bold">One last step</h1>
        <p className="text-center text-sm text-slate-600">Add your WhatsApp number so organisers can reach you about matches and payments.</p>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Phone (WhatsApp)" htmlFor="phone">
            <Input id="phone" type="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </form>
        <Button variant="outline" className="w-full" onClick={() => void authService.signOut()} disabled={saving}>
          Sign out
        </Button>
      </Card>
    </div>
  )
}
