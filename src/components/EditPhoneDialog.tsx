import * as Dialog from '@radix-ui/react-dialog'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useSetUserPhone } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { PlayerSummary } from '@/types/domain'
import { normalizePhone } from '@/utils/phone'

/** Admin corrects a player's number directly (for example when they have lost their old one). Logged in the activity history. */
export function EditPhoneDialog({ player, onClose }: { player: PlayerSummary | null; onClose: () => void }) {
  const setPhone = useSetUserPhone()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function close() {
    if (setPhone.isPending) return
    onClose()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!player || setPhone.isPending) return
    const normalized = normalizePhone(value)
    if (!normalized) return setError('Enter a valid phone number.')
    setError(null)
    try {
      await setPhone.mutateAsync({ userId: player.id, phone: normalized })
      onClose()
    } catch (err) {
      setError(toFriendlyMessage(err))
    }
  }

  return (
    <Dialog.Root open={!!player} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 space-y-4 rounded-lg bg-white p-5 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">Change phone for {player?.full_name}</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Current number: {player?.phone ?? 'none'}. The change takes effect right away and is recorded in the activity history.
          </Dialog.Description>
          <form onSubmit={save} className="space-y-4" noValidate>
            <Field label="New phone number" htmlFor="adminNewPhone">
              <Input id="adminNewPhone" type="tel" autoComplete="off" placeholder="98765 43210" value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={setPhone.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={setPhone.isPending}>
                {setPhone.isPending ? 'Saving...' : 'Save number'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
