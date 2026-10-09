import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useSetTempPassword } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { PlayerSummary } from '@/types/domain'
import { generateTempPassword } from '@/utils/password'
import { buildWhatsAppChatUrl } from '@/utils/whatsapp'

/** Admin sets a temporary password, then shares it. The password is shown only here, once. */
export function TempPasswordDialog({ player, onClose }: { player: PlayerSummary | null; onClose: () => void }) {
  const setPassword = useSetTempPassword()
  const [password, setPasswordValue] = useState(generateTempPassword)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function close() {
    if (setPassword.isPending) return
    onClose()
  }

  async function save() {
    if (!player || setPassword.isPending) return
    setError(null)
    try {
      await setPassword.mutateAsync({ userId: player.id, password })
      setDone(true)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  const message = player ? `Hi ${player.full_name.split(/\s+/)[0]}, your temporary password for the cricket app is: ${password}. Please log in and change it from your Profile.` : ''
  const whatsapp = player?.phone ? buildWhatsAppChatUrl(player.phone, message) : null

  return (
    <Dialog.Root open={!!player} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 space-y-4 rounded-lg bg-white p-5 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">Temporary password for {player?.full_name}</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            {done
              ? 'Password set. They have been signed out everywhere. This is the only time it is shown, so share it now.'
              : 'This replaces their current password and signs them out everywhere. You will then share the new one with them.'}
          </Dialog.Description>
          <p className="rounded-md bg-slate-100 px-3 py-2 text-center font-mono text-lg tracking-wide" aria-label="Temporary password">
            {password}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {done ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(password)
                    setCopied(true)
                  } catch {
                    setCopied(false)
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy password'}
              </Button>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white">
                  Send on WhatsApp
                </a>
              )}
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={close} disabled={setPassword.isPending}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setPasswordValue(generateTempPassword())} disabled={setPassword.isPending}>
                New random one
              </Button>
              <Button onClick={save} loading={setPassword.isPending}>
                {setPassword.isPending ? 'Saving...' : 'Set password'}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
