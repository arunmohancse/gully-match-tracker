import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MatchForm } from '@/components/MatchForm'
import { useMatch, useMatches, useSaveMatch } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { copyMatchToForm, formToInput, type MatchFormValues } from '@/utils/matchForm'

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

  if (isEdit && isLoading) return <p className="text-slate-500">Loading match...</p>
  if (isEdit && !match) return <p className="text-slate-600">Match not found.</p>
  if (!isEdit && (loadingAll || (copyId && loadingSource))) return <p className="text-slate-500">Loading...</p>

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit match' : source ? 'Copy match' : 'Create match'}</h1>
      {source && (
        <p className="text-sm text-slate-600">
          Copied from <span className="font-medium">{source.title}</span>. Check the title and date, then create it. Players and payments are not copied.
        </p>
      )}
      <MatchForm
        match={match ?? undefined}
        defaults={defaults}
        submitting={save.isPending}
        error={error}
        submitLabel={isEdit ? 'Save changes' : 'Create match'}
        submittingLabel={isEdit ? 'Saving...' : 'Creating...'}
        onSubmit={onSubmit}
      />
    </div>
  )
}
