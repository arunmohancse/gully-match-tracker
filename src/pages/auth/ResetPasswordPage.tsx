import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { validateNewPassword } from '@/utils/password'
import { normalizePhone } from '@/utils/phone'
import { AuthShell } from './AuthShell'

type FormState = { email: string; phone: string; password: string; confirm: string }

/** Logged-out reset. Works only after an admin has switched "reset link" on for this account. */
export function ResetPasswordPage() {
  const [form, setForm] = useState<FormState>({ email: '', phone: '', password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const phone = normalizePhone(form.phone)
    const problem = !phone ? 'Enter the phone number you signed up with.' : validateNewPassword(form.password, form.confirm)
    if (problem || !phone) return setError(problem)

    setSubmitting(true)
    setError(null)
    try {
      await authService.resetPasswordWithPhone({ email: form.email.trim(), phone, password: form.password })
      setDone(true)
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthShell title="Password changed">
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Your password has been changed. You can log in with the new one now.
        </p>
        <Link to="/login" className="block text-center text-sm font-medium text-brand underline">
          Go to log in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset password">
      <p className="text-sm text-slate-600">Ask an admin to allow a password reset for your account first. Then enter your details and a new password.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Phone you signed up with" htmlFor="phone">
          <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="New password" htmlFor="password">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? 'Saving...' : 'Change password'}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-600">
        <Link to="/login" className="font-medium text-brand underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  )
}
