import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { normalizePhone } from '@/utils/phone'
import { AuthShell } from './AuthShell'

type FormState = { fullName: string; phone: string; email: string; password: string }

export function SignupPage() {
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const phone = normalizePhone(form.phone)
    const next: typeof errors = {}
    if (!form.fullName.trim()) next.fullName = 'Please enter your name.'
    if (!phone) next.phone = 'Enter a valid phone number (WhatsApp preferred).'
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.'
    setErrors(next)
    if (!phone || Object.keys(next).length) return

    setSubmitting(true)
    setFormError(null)
    try {
      await authService.signUp({ email: form.email.trim(), password: form.password, fullName: form.fullName.trim(), phone })
      // If email confirmation is off, a session now exists and RedirectIfAuthed moves the user on.
      setCreated(true)
    } catch (err) {
      setFormError(toFriendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Create account">
      {created && (
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Account created. If you aren't logged in automatically, check your email to confirm, then log in. An admin must approve your account before you can register for matches.
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <Input id="fullName" autoComplete="name" value={form.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Phone (WhatsApp)" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? 'Creating account...' : 'Sign up'}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
