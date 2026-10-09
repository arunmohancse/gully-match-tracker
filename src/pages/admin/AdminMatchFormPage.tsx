import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MatchForm } from '@/components/MatchForm'
import { useMatch, useSaveMatch } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { formToInput, type MatchFormValues } from '@/utils/matchForm'

/** Handles both /admin/matches/new and /admin/matches/:id/edit. */
export function AdminMatchFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const { data: match, isLoading } = useMatch(id)
  const save = useSaveMatch()
  const [error, setError] = useState<string | null>(null)

  if (isEdit && isLoading) return <p className="text-slate-500">Loading match...</p>
  if (isEdit && !match) return <p className="text-slate-600">Match not found.</p>

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
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit match' : 'Create match'}</h1>
      <MatchForm
        match={match ?? undefined}
        submitting={save.isPending}
        error={error}
        submitLabel={isEdit ? 'Save changes' : 'Create match'}
        submittingLabel={isEdit ? 'Saving...' : 'Creating...'}
        onSubmit={onSubmit}
      />
    </div>
  )
}
