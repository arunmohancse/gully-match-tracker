import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import { Textarea } from '@/components/ui/textarea'
import type { Match } from '@/types/domain'
import { EMPTY_FORM, matchToForm, validateMatchForm, type MatchFormErrors, type MatchFormValues } from '@/utils/matchForm'

interface Props {
  match?: Match
  /** Starting values for a new match (for example the venue of the last one). Ignored when editing. */
  defaults?: Partial<MatchFormValues>
  submitting: boolean
  error: string | null
  submitLabel: string
  submittingLabel: string
  onSubmit: (values: MatchFormValues, imageFile: File | null) => void
}

export function MatchForm({ match, defaults, submitting, error, submitLabel, submittingLabel, onSubmit }: Props) {
  const [values, setValues] = useState<MatchFormValues>(match ? matchToForm(match) : { ...EMPTY_FORM, ...defaults })
  const [errors, setErrors] = useState<MatchFormErrors>({})

  const set = (key: keyof MatchFormValues) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues({ ...values, [key]: e.target.value })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const found = validateMatchForm(values)
    setErrors(found)
    // The announcement image upload is hidden for now; the page, hook and service still support it.
    if (Object.keys(found).length === 0) onSubmit(values, null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="Match title" htmlFor="title" error={errors.title}>
        <Input id="title" value={values.title} onChange={set('title')} placeholder="Gully League Community Match" />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" value={values.description} onChange={set('description')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="matchDate" error={errors.matchDate}>
          <Input id="matchDate" type="date" value={values.matchDate} onChange={set('matchDate')} />
        </Field>
        <Field label="Start time" htmlFor="startTime" error={errors.startTime}>
          <TimeSelect id="startTime" value={values.startTime} onChange={(v) => setValues({ ...values, startTime: v })} />
        </Field>
        <Field label="End time (optional)" htmlFor="endTime" error={errors.endTime}>
          <TimeSelect id="endTime" optional value={values.endTime} onChange={(v) => setValues({ ...values, endTime: v })} />
        </Field>
      </div>

      <Field label="Venue" htmlFor="venue" error={errors.venue}>
        <Input id="venue" value={values.venue} onChange={set('venue')} />
      </Field>

      <Field label="Google Maps link (optional)" htmlFor="mapUrl" error={errors.mapUrl}>
        <Input id="mapUrl" type="url" inputMode="url" value={values.mapUrl} onChange={set('mapUrl')} placeholder="https://maps.app.goo.gl/..." />
      </Field>
      <p className="-mt-2 text-sm text-slate-500">In Google Maps, open the turf, tap Share, then Copy link, and paste it here. Players get an Open in Google Maps button.</p>

      <Field label="Maximum players" htmlFor="maxPlayers" error={errors.maxPlayers}>
        <Input id="maxPlayers" type="number" inputMode="numeric" min={1} value={values.maxPlayers} onChange={set('maxPlayers')} />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How is the cost paid?</legend>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input type="radio" name="costModel" className="mt-1 size-4 accent-green-700" checked={values.costModel === 'SHARED_COST'} onChange={() => setValues({ ...values, costModel: 'SHARED_COST' })} />
          <span>
            <span className="block font-medium">Shared after the match</span>
            <span className="block text-sm text-slate-600">No fee up front. After the match you add the expenses and they are split equally among the main-list players.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
          <input type="radio" name="costModel" className="mt-1 size-4 accent-green-700" checked={values.costModel === 'FIXED_FEE'} onChange={() => setValues({ ...values, costModel: 'FIXED_FEE' })} />
          <span>
            <span className="block font-medium">Fixed fee per player</span>
            <span className="block text-sm text-slate-600">Every player pays the same amount, set now.</span>
          </span>
        </label>
        {values.costModel === 'FIXED_FEE' && (
          <Field label="Registration fee (₹)" htmlFor="registrationFee" error={errors.registrationFee}>
            <Input id="registrationFee" type="number" inputMode="decimal" min={0} step="0.01" value={values.registrationFee} onChange={set('registrationFee')} />
          </Field>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Registration opens on (optional)" htmlFor="opensAt" error={errors.opensAt}>
          <Input id="opensAt" type="date" value={values.opensAt} onChange={set('opensAt')} />
        </Field>
        <Field label="Registration closes on (optional)" htmlFor="closesAt" error={errors.closesAt}>
          <Input id="closesAt" type="date" value={values.closesAt} onChange={set('closesAt')} />
        </Field>
      </div>
      <p className="-mt-2 text-sm text-slate-500">Registration opens at the start of the opening day and closes at the end of the closing day. Leave blank for no limit.</p>

      <Field label="Rules & instructions" htmlFor="rules">
        <Textarea id="rules" value={values.rules} onChange={set('rules')} />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={submitting}>
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </form>
  )
}
