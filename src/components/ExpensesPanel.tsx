import { Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useDeleteExpense, useExpenses, useSaveExpense } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { Expense } from '@/types/domain'
import { EXPENSE_CATEGORIES, formatINR, parseMoney } from '@/utils/money'

const EMPTY = { description: '', category: 'Turf', amount: '' }

export function ExpensesPanel({ matchId }: { matchId: string }) {
  const { data, isLoading, error } = useExpenses(matchId)
  const save = useSaveExpense(matchId)
  const remove = useDeleteExpense()
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Expense | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const expenses = data ?? []
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    const amount = parseMoney(form.amount)
    const found: typeof errors = {}
    if (!form.description.trim()) found.description = 'Enter a description.'
    if (amount === null || amount <= 0) found.amount = 'Enter an amount above 0.'
    setErrors(found)
    if (Object.keys(found).length || amount === null) return

    setFormError(null)
    try {
      await save.mutateAsync({ id: editingId ?? undefined, input: { description: form.description.trim(), category: form.category.trim() || 'Other', amount } })
      setForm(EMPTY)
      setEditingId(null)
    } catch (err) {
      setFormError(toFriendlyMessage(err))
    }
  }

  function startEdit(x: Expense) {
    setEditingId(x.id)
    setForm({ description: x.description, category: x.category, amount: String(x.amount) })
    setErrors({})
    setFormError(null)
  }

  async function confirmDelete() {
    if (!toDelete || remove.isPending) return
    setDeleteError(null)
    try {
      await remove.mutateAsync(toDelete.id)
      if (editingId === toDelete.id) {
        setEditingId(null)
        setForm(EMPTY)
      }
      setToDelete(null)
    } catch (err) {
      setDeleteError(toFriendlyMessage(err))
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Expenses</h2>
        <span className="font-semibold">{formatINR(total)}</span>
      </div>

      {isLoading && <p className="text-slate-500">Loading expenses...</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {toFriendlyMessage(error)}
        </p>
      )}
      {!isLoading && !error && expenses.length === 0 && <p className="text-sm text-slate-500">No expenses recorded yet.</p>}

      {expenses.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {expenses.map((x) => (
            <li key={x.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{x.description}</div>
                <div className="text-slate-500">{x.category}</div>
              </div>
              <span className="font-semibold">{formatINR(x.amount)}</span>
              <Button size="sm" variant="ghost" aria-label={`Edit ${x.description}`} onClick={() => startEdit(x)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Delete ${x.description}`} onClick={() => { setDeleteError(null); setToDelete(x) }}>
                <Trash2 className="size-4 text-red-600" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="space-y-3 border-t border-slate-100 pt-3" noValidate>
        <h3 className="text-sm font-semibold">{editingId ? 'Edit expense' : 'Add expense'}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Description" htmlFor="exp-desc" error={errors.description}>
            <Input id="exp-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Turf booking" />
          </Field>
          <Field label="Category" htmlFor="exp-cat">
            <Input id="exp-cat" list="expense-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <datalist id="expense-categories">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Amount (₹)" htmlFor="exp-amt" error={errors.amount}>
            <Input id="exp-amt" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending}>
            {save.isPending ? 'Saving...' : editingId ? 'Save expense' : 'Add expense'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY); setErrors({}) }}>
              Cancel edit
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this expense?"
        description={toDelete ? `${toDelete.description} (${formatINR(toDelete.amount)}) will be removed from the totals.` : ''}
        confirmLabel="Delete expense"
        loadingLabel="Deleting..."
        cancelLabel="Keep it"
        destructive
        loading={remove.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}
