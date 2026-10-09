import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { PlayerSummary } from '@/types/domain'

function Item({ children, onClick, danger, disabled }: { children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-11 w-full items-center rounded-md px-3 text-left text-base hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50',
        danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-800',
      )}
    >
      {children}
    </button>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  )
}

interface Props {
  player: PlayerSummary | null
  resetOpen: boolean
  busy: boolean
  onClose: () => void
  onBlock: (p: PlayerSummary) => void
  onUnblock: (p: PlayerSummary) => void
  onChangeRole: (p: PlayerSummary) => void
  onSetPassword: (p: PlayerSummary) => void
  onToggleReset: (p: PlayerSummary) => void
}

/** The less common actions for one player, tucked away so the list stays calm. A bottom sheet on phones, a dialog on larger screens. */
export function ManagePlayerSheet({ player, resetOpen, busy, onClose, onBlock, onUnblock, onChangeRole, onSetPassword, onToggleReset }: Props) {
  // Close first, then run the action (which may open its own confirmation dialog).
  const act = (fn: (p: PlayerSummary) => void) => () => {
    if (!player) return
    onClose()
    fn(player)
  }

  return (
    <Dialog.Root open={!!player} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-md space-y-1 overflow-y-auto rounded-t-xl bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg sm:inset-x-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <Dialog.Title className="px-3 pt-2 text-lg font-semibold">{player?.full_name}</Dialog.Title>
          <Dialog.Description className="px-3 text-sm text-slate-600">{player?.phone ?? 'No phone number'}</Dialog.Description>

          {player && (
            <>
              <Group title="Password">
                <Item onClick={act(onSetPassword)}>Set a temporary password</Item>
                <Item onClick={act(onToggleReset)} disabled={busy}>
                  {resetOpen ? 'Turn off the reset link' : 'Allow the reset link (24 hours)'}
                </Item>
              </Group>

              {player.status === 'ACTIVE' && (
                <Group title="Role">
                  <Item onClick={act(onChangeRole)}>{player.role === 'ADMIN' ? 'Remove admin rights' : 'Make admin'}</Item>
                </Group>
              )}

              <Group title="Account">
                {player.status === 'BLOCKED' ? (
                  <Item onClick={act(onUnblock)} disabled={busy}>
                    Unblock player
                  </Item>
                ) : (
                  <Item onClick={act(onBlock)} danger>
                    {player.status === 'PENDING' ? 'Reject signup' : 'Block player'}
                  </Item>
                )}
              </Group>
            </>
          )}

          <div className="pt-2">
            <Dialog.Close className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-base font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
