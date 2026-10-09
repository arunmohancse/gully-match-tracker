import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  loadingLabel?: string
  destructive?: boolean
  loading?: boolean
  error?: string | null
  /** Extra content between the description and the buttons (e.g. a selector). */
  children?: ReactNode
  confirmDisabled?: boolean
  cancelLabel?: string
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loadingLabel,
  destructive,
  loading,
  error,
  children,
  confirmDisabled,
  cancelLabel = 'Keep as is',
  onConfirm,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90vh] max-w-sm -translate-y-1/2 space-y-4 overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">{description}</Dialog.Description>
          {children}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
              {loading ? (loadingLabel ?? 'Working...') : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
