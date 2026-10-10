import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { brand } from '@/config/brand'
import { GoogleButton } from '@/components/GoogleButton'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await authService.signIn(email.trim(), password)
      navigate(from ?? '/', { replace: true })
    } catch (err) {
      setError(toFriendlyMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Log in">
      <GoogleButton />
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/reset-password" className="font-medium text-brand underline">
          Forgot password?
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link to="/about" className="font-medium text-brand underline">
          About {brand.name}
        </Link>
      </p>
      <p className="text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/signup" className="font-medium text-brand underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
