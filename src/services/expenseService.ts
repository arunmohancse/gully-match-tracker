import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/types/domain'

export interface ExpenseInput {
  description: string
  category: string
  amount: number
}

export const expenseService = {
  async list(matchId: string): Promise<Expense[]> {
    return (unwrap(await supabase.from('expenses').select('*').eq('match_id', matchId).order('created_at')) ?? []) as Expense[]
  },

  async create(matchId: string, input: ExpenseInput): Promise<void> {
    unwrap(await supabase.from('expenses').insert({ match_id: matchId, ...input }))
  },

  async update(id: string, input: ExpenseInput): Promise<void> {
    unwrap(await supabase.from('expenses').update(input).eq('id', id))
  },

  async remove(id: string): Promise<void> {
    unwrap(await supabase.from('expenses').delete().eq('id', id))
  },
}
