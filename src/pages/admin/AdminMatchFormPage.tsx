import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MatchForm } from '@/components/MatchForm'
import { useMatch, useMatches, useSaveMatch } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { copyMatchToForm, formToInput, type MatchFormValues } from '@/utils/matchForm'
import { CricketLoader } from '@/components/CricketLoader'

/** Handles /admin/matches/new, /admin/matches/new?copy=<match id> and /admin/matches/:id/edit. */
export function AdminMatchFormPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const copyId = searchParams.get('copy') ?? undefined
  const navigate = useNavigate()
  const isEdit = !!id
  const { data: match, isLoading } = useMatch(id)
  const { data: source, isLoading: loadingSource } = useMatch(isEdit ? undefined : copyId)
  const { data: allMatches, isLoading: loadingAll } = useMatches('all')
  const save = useSaveMatch()
  const [error, setError] = useState<string | null>(null)

  if (isEdit && isLoading) return <CricketLoader label="Loading match" />
  if (isEdit && !match) return <p className="text-muted">Match not found.</p>
  if (!isEdit && (loadingAll || (copyId && loadingSource))) return <CricketLoader label="Loading" />

  // A copy starts from the chosen match. A plain new match starts with the venue and map link of the latest one,
  // since most matches are at the same turf.
  const lastMatch = isEdit ? undefined : allMatches?.[0]
  const defaults: Partial<MatchFormValues> | undefined = source
    ? copyMatchToForm(source)
    : lastMatch
      ? { venue: lastMatch.venue, mapUrl: lastMatch.map_url ?? '' }
      : undefined

  async function onSubmit(values: MatchFormValues, imageFile: File | null) {
    setError(null)
    try {
      const saved = await save.mutateAsync({
        id,
        input: formToInput(values, match?.image_path ?? null, match),
        imageFile,
        previousImagePath: match?.image_path ?? null,
      })
      navigate(`/admin/matches/${saved.id}`)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <MatchForm
      match={match ?? undefined}
      defaults={defaults}
      heading={isEdit ? 'Edit match' : source ? 'Copy match' : 'New match'}
      backTo={isEdit && id ? `/admin/matches/${id}` : '/admin/matches'}
      notice={
        source && (
          <p className="rounded-2xl border border-info-soft bg-info-soft px-4 py-3 text-sm text-info">
            Copied from <span className="font-bold">{source.title}</span>. Check the title and date, then create it. Players and payments are not copied.
          </p>
        )
      }
      submitting={save.isPending}
      error={error}
      submitLabel={isEdit ? 'Save changes' : 'Create match'}
      submittingLabel={isEdit ? 'Saving...' : 'Creating...'}
      onSubmit={onSubmit}
    />
  )
}
