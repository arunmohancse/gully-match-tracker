import { CalendarDays, Check, ChevronLeft, Link2, ListChecks, LockOpen, MapPin, Type, Users } from 'lucide-react'
import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CostTiles, DateStrip, FieldError, FormSection, Optional, PlayersStepper, TimeNote, TimeTile } from '@/components/MatchFormParts'
import { Button } from '@/components/ui/button'
import { formInput, formLabel } from '@/components/ui/form-styles'
import { Segmented } from '@/components/ui/segmented'
import { TimeSelect } from '@/components/ui/time-select'
import { cn } from '@/lib/utils'
import type { Match } from '@/types/domain'
import { dateBlockParts, durationLabel, formatMatchDate, formatShortDate, formatTime, formatWeekday } from '@/utils/dates'
import { isGoogleMapsUrl } from '@/utils/mapLink'
import { EMPTY_FORM, matchToForm, validateMatchForm, type MatchFormErrors, type MatchFormValues } from '@/utils/matchForm'

interface Props {
  match?: Match
  /** Starting values for a new match (for example the venue of the last one). Ignored when editing. */
  defaults?: Partial<MatchFormValues>
  /** "New match", "Edit match" or "Copy match". */
  heading: string
  /** Where the back link in the header goes. */
  backTo: string
  /** Shown under the header, e.g. which match a copy came from. */
  notice?: ReactNode
  submitting: boolean
  error: string | null
  submitLabel: string
  submittingLabel: string
  onSubmit: (values: MatchFormValues, imageFile: File | null) => void
}

const TITLE_IDEAS = ['Community Match', 'Weekend Practice', 'Box Cricket']

/** "2026-10-22" -> "Thu, 22 Oct" */
const shortDay = (iso: string) => `${formatWeekday(iso).slice(0, 3)}, ${formatShortDate(iso).replace(/ \d{4}$/, '')}`

export function MatchForm({ match, defaults, heading, backTo, notice, submitting, error, submitLabel, submittingLabel, onSubmit }: Props) {
  const [values, setValues] = useState<MatchFormValues>(match ? matchToForm(match) : { ...EMPTY_FORM, ...defaults })
  const [errors, setErrors] = useState<MatchFormErrors>({})
  const [openTime, setOpenTime] = useState<'start' | 'end' | null>(values.startTime ? null : 'start')
  const [editingMap, setEditingMap] = useState(!isGoogleMapsUrl(values.mapUrl))
  const [opensMode, setOpensMode] = useState<'now' | 'schedule'>(values.opensAt ? 'schedule' : 'now')
  const [closesMode, setClosesMode] = useState<'none' | 'day'>(values.closesAt ? 'day' : 'none')
  const ids = useId()

  const patch = (p: Partial<MatchFormValues>) => setValues((v) => ({ ...v, ...p }))
  const set = (key: keyof MatchFormValues) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch({ [key]: e.target.value })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const found = validateMatchForm(values)
    setErrors(found)
    if (found.startTime) setOpenTime('start')
    else if (found.endTime) setOpenTime('end')
    if (found.mapUrl) setEditingMap(true)
    // The announcement image upload is hidden for now; the page, hook and service still support it.
    if (Object.keys(found).length === 0) onSubmit(values, null)
  }

  const duration = durationLabel(values.startTime, values.endTime)
  const mapLinked = !editingMap && isGoogleMapsUrl(values.mapUrl)
  const summary = [values.matchDate && shortDay(values.matchDate), values.startTime && formatTime(values.startTime), values.maxPlayers && `${values.maxPlayers} players`]
    .filter(Boolean)
    .join(' · ')

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
      <header className="space-y-3.5 rounded-[20px] bg-pitch p-4 text-on-pitch sm:p-5">
        <Link to={backTo} className="-ml-1 inline-flex min-h-9 items-center gap-1 text-sm font-bold text-on-pitch-muted hover:text-on-pitch">
          <ChevronLeft className="size-4" aria-hidden /> Back
        </Link>
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-stumps">Admin · Schedule</p>
          <h1 className="font-display text-[44px] font-bold uppercase leading-[0.95]">{heading}</h1>
        </div>
        <MatchPreview values={values} />
      </header>

      {notice}

      <FormSection icon={Type} title="The match">
        <div className="space-y-2">
          <label htmlFor="title" className={formLabel}>
            Title
          </label>
          <input id="title" value={values.title} onChange={set('title')} placeholder="Gully League Community Match" className={cn(formInput, 'text-[17px] font-bold', errors.title && 'border-danger-line')} />
          <FieldError>{errors.title}</FieldError>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Title ideas">
            {TITLE_IDEAS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => patch({ title: t })}
                className="h-8 rounded-full border border-line px-3 text-xs font-semibold text-muted hover:border-line-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="description" className={formLabel}>
            Description
            <Optional />
          </label>
          <textarea id="description" rows={3} value={values.description} onChange={set('description')} placeholder="Format, overs, what to bring…" className={cn(formInput, 'h-auto min-h-24 resize-y py-3 font-medium')} />
        </div>
      </FormSection>

      <FormSection icon={CalendarDays} title={<span id={`${ids}-date`}>When</span>} aside={values.matchDate ? dateBlockParts(values.matchDate).month : undefined}>
        <DateStrip value={values.matchDate} onChange={(matchDate) => patch({ matchDate })} labelledBy={`${ids}-date`} />
        <FieldError>{errors.matchDate}</FieldError>
        <div className="grid grid-cols-2 gap-2.5">
          <TimeTile label="Starts" value={values.startTime} open={openTime === 'start'} invalid={!!errors.startTime} controls={`${ids}-time`} onToggle={() => setOpenTime(openTime === 'start' ? null : 'start')} />
          <TimeTile
            label={
              <>
                Ends
                <Optional />
              </>
            }
            value={values.endTime}
            open={openTime === 'end'}
            invalid={!!errors.endTime}
            controls={`${ids}-time`}
            onToggle={() => setOpenTime(openTime === 'end' ? null : 'end')}
          />
        </div>
        {openTime && (
          <div id={`${ids}-time`} className="space-y-2 rounded-2xl bg-surface-3 p-3">
            <div className="flex items-center justify-between">
              <label htmlFor={openTime === 'start' ? 'startTime' : 'endTime'} className={formLabel}>
                {openTime === 'start' ? 'Start time' : 'End time'}
              </label>
              {openTime === 'end' && values.endTime && (
                <button type="button" onClick={() => patch({ endTime: '' })} className="min-h-8 px-1 text-sm font-bold text-brand hover:underline">
                  Clear
                </button>
              )}
            </div>
            {openTime === 'start' ? (
              <TimeSelect id="startTime" value={values.startTime} onChange={(startTime) => patch({ startTime })} />
            ) : (
              <TimeSelect id="endTime" optional value={values.endTime} onChange={(endTime) => patch({ endTime })} />
            )}
            <button type="button" onClick={() => setOpenTime(null)} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-surface text-sm font-bold hover:bg-surface-2">
              <Check className="size-4" aria-hidden /> Done
            </button>
          </div>
        )}
        <FieldError>{errors.startTime}</FieldError>
        <FieldError>{errors.endTime}</FieldError>
        {values.matchDate && (
          <TimeNote>
            {formatWeekday(values.matchDate)}, {formatMatchDate(values.matchDate).replace(/ \d{4}$/, '')}
            {duration && ` · ${duration}`}
          </TimeNote>
        )}
      </FormSection>

      <FormSection icon={MapPin} title="Where">
        <div className="space-y-2">
          <label htmlFor="venue" className={formLabel}>
            Ground
          </label>
          <input id="venue" value={values.venue} onChange={set('venue')} placeholder="Turf name, area" className={cn(formInput, errors.venue && 'border-danger-line')} />
          <FieldError>{errors.venue}</FieldError>
        </div>
        {mapLinked ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand/12 p-2.5 pl-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground" aria-hidden>
              <Check className="size-[18px]" strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">Google Maps linked</span>
              <span className="block truncate text-xs text-muted">{values.mapUrl.replace(/^https:\/\//, '')}</span>
            </span>
            <button type="button" onClick={() => setEditingMap(true)} className="h-9 shrink-0 rounded-xl border border-line-strong bg-surface px-3 text-sm font-bold hover:bg-surface-2">
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label htmlFor="mapUrl" className={formLabel}>
              Google Maps link
              <Optional />
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
              <input
                id="mapUrl"
                type="url"
                inputMode="url"
                value={values.mapUrl}
                onChange={set('mapUrl')}
                onBlur={() => isGoogleMapsUrl(values.mapUrl) && setEditingMap(false)}
                placeholder="https://maps.app.goo.gl/..."
                className={cn(formInput, 'pl-10 font-medium', errors.mapUrl && 'border-danger-line')}
              />
            </div>
            <FieldError>{errors.mapUrl}</FieldError>
          </div>
        )}
        <p className="text-xs leading-relaxed text-subtle">Players get an “Open in Google Maps” button. To add one: in Google Maps, open the turf, tap Share, then Copy link, and paste it here.</p>
      </FormSection>

      <FormSection icon={Users} title="Squad & cost">
        <PlayersStepper value={values.maxPlayers} onChange={(maxPlayers) => patch({ maxPlayers })} error={errors.maxPlayers} />
        <div className="h-px bg-line" />
        <fieldset className="space-y-3">
          <legend className="mb-3 font-extrabold">How is it paid?</legend>
          <CostTiles value={values.costModel} onChange={(costModel) => patch({ costModel })} />
          {values.costModel === 'FIXED_FEE' && (
            <div className="space-y-2">
              <label htmlFor="registrationFee" className={formLabel}>
                Fee per player
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-extrabold text-muted" aria-hidden>
                  ₹
                </span>
                <input
                  id="registrationFee"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={values.registrationFee}
                  onChange={set('registrationFee')}
                  className={cn(formInput, 'pl-9 font-display text-2xl font-bold', errors.registrationFee && 'border-danger-line')}
                />
              </div>
              <FieldError>{errors.registrationFee}</FieldError>
            </div>
          )}
        </fieldset>
      </FormSection>

      <FormSection icon={LockOpen} title="Registration">
        <div className="space-y-2">
          <span className={formLabel} id={`${ids}-opens`}>
            Opens
          </span>
          <Segmented
            label="Registration opens"
            value={opensMode}
            options={[
              { value: 'now', label: 'Right away' },
              { value: 'schedule', label: 'Schedule' },
            ]}
            onChange={(mode) => {
              setOpensMode(mode)
              if (mode === 'now') patch({ opensAt: '', opensTime: '' })
            }}
          />
          {opensMode === 'schedule' && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="opensAt" className="text-sm font-semibold text-muted">
                  Day
                </label>
                <input id="opensAt" type="date" value={values.opensAt} onChange={set('opensAt')} className={cn(formInput, 'h-12', errors.opensAt && 'border-danger-line')} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="opensTime" className="text-sm font-semibold text-muted">
                  Time <span className="font-normal text-subtle">(start of the day if blank)</span>
                </label>
                <TimeSelect id="opensTime" optional value={values.opensTime} onChange={(opensTime) => patch({ opensTime })} />
              </div>
            </div>
          )}
          <FieldError>{errors.opensAt}</FieldError>
          <FieldError>{errors.opensTime}</FieldError>
        </div>
        <div className="space-y-2">
          <span className={formLabel}>Closes</span>
          <Segmented
            label="Registration closes"
            value={closesMode}
            options={[
              { value: 'none', label: 'No limit' },
              { value: 'day', label: 'Pick a day' },
            ]}
            onChange={(mode) => {
              setClosesMode(mode)
              if (mode === 'none') patch({ closesAt: '' })
            }}
          />
          {closesMode === 'day' && (
            <div className="space-y-1.5">
              <label htmlFor="closesAt" className="text-sm font-semibold text-muted">
                Last day to register <span className="font-normal text-subtle">(closes at the end of the day)</span>
              </label>
              <input id="closesAt" type="date" value={values.closesAt} onChange={set('closesAt')} className={cn(formInput, 'h-12', errors.closesAt && 'border-danger-line')} />
            </div>
          )}
          <FieldError>{errors.closesAt}</FieldError>
        </div>
        <p className="rounded-xl bg-surface-3 px-3 py-2.5 text-[13px] leading-relaxed text-muted">
          {values.opensAt ? (
            <>
              Opens <b className="text-fg">{shortDay(values.opensAt)}, {values.opensTime ? formatTime(values.opensTime) : 'start of the day'}</b>.
            </>
          ) : opensMode === 'schedule' ? (
            'Pick the day registration opens.'
          ) : (
            'Opens as soon as you create the match.'
          )}{' '}
          {values.closesAt ? (
            <>
              Closes at the end of <b className="text-fg">{shortDay(values.closesAt)}</b>.
            </>
          ) : (
            'No closing day.'
          )}
        </p>
      </FormSection>

      <FormSection icon={ListChecks} title={<label htmlFor="rules">Rules &amp; instructions</label>} aside="optional">
        <textarea id="rules" rows={4} value={values.rules} onChange={set('rules')} placeholder="Reach 15 minutes early, bring your own bat if you have one…" className={cn(formInput, 'h-auto min-h-28 resize-y py-3 font-medium')} />
      </FormSection>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 space-y-1.5 border-t border-line bg-surface/95 px-4 pb-3 pt-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-t-2xl md:border-x">
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {Object.keys(errors).length > 0 && !error && (
          <p role="alert" className="text-sm font-semibold text-danger">
            Check the highlighted fields above.
          </p>
        )}
        <Button type="submit" size="lg" className="h-13 w-full rounded-2xl text-base font-extrabold" loading={submitting}>
          {!submitting && <Check className="size-5" strokeWidth={2.6} aria-hidden />}
          {submitting ? submittingLabel : submitLabel}
        </Button>
        {summary && <p className="text-center text-xs text-muted">{summary}</p>}
      </div>
    </form>
  )
}

/** The match card as players will see it, updating as the form is filled in. */
function MatchPreview({ values }: { values: MatchFormValues }) {
  const date = values.matchDate ? dateBlockParts(values.matchDate) : null
  const time = values.startTime ? `${formatTime(values.startTime)}${values.endTime ? ` – ${formatTime(values.endTime)}` : ''}` : 'Time not set'
  return (
    <section aria-label="Preview" className="flex items-center gap-3.5 rounded-[18px] border border-white/15 bg-black/20 p-3.5">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-white py-1.5 leading-none text-[#0b3d20]" aria-hidden>
        <span className="text-[10px] font-extrabold tracking-[0.14em]">{date?.weekday ?? 'DAY'}</span>
        <span className="font-display text-[30px] font-bold">{date ? Number(date.day) : '--'}</span>
        <span className="text-[10px] font-extrabold tracking-[0.14em] text-[#0e773d]">{date?.month ?? 'MON'}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-stumps">Preview</p>
        <p className="truncate font-extrabold">{values.title.trim() || 'Match title'}</p>
        <p className="truncate text-[13px] text-on-pitch-muted">
          {time}
          {values.venue.trim() && ` · ${values.venue.trim()}`}
        </p>
        <p className="text-xs font-bold text-on-pitch-muted">
          {values.maxPlayers || '?'} spots · {values.costModel === 'FIXED_FEE' ? `₹${values.registrationFee || 0} each` : 'Shared cost'}
        </p>
      </div>
    </section>
  )
}
