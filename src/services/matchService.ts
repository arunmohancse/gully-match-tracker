import { MATCH_COLUMNS } from '@/lib/columns'
import { AppError, toFriendlyMessage, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Match, MatchInput, MatchStatus } from '@/types/domain'
import { todayISO } from '@/utils/dates'

const IMAGE_BUCKET = 'match-images'

export type MatchScope = 'upcoming' | 'past' | 'all'

export const matchService = {
  async list(scope: MatchScope): Promise<Match[]> {
    const today = todayISO()
    let query = supabase.from('matches').select(MATCH_COLUMNS)
    if (scope === 'upcoming') query = query.gte('match_date', today).order('match_date').order('start_time')
    else if (scope === 'past') query = query.lt('match_date', today).order('match_date', { ascending: false })
    else query = query.order('match_date', { ascending: false }).order('start_time')
    return (unwrap(await query) ?? []) as unknown as Match[]
  },

  async get(id: string): Promise<Match | null> {
    return unwrap(await supabase.from('matches').select(MATCH_COLUMNS).eq('id', id).maybeSingle()) as unknown as Match | null
  },

  async create(input: MatchInput): Promise<Match> {
    const data = unwrap(await supabase.from('matches').insert(input).select(MATCH_COLUMNS).single()) as unknown as Match | null
    if (!data) throw new AppError(toFriendlyMessage(null))
    return data
  },

  async update(id: string, input: Partial<MatchInput>): Promise<Match> {
    const data = unwrap(await supabase.from('matches').update(input).eq('id', id).select(MATCH_COLUMNS).single()) as unknown as Match | null
    if (!data) throw new AppError(toFriendlyMessage(null))
    return data
  },

  async setStatus(id: string, status: MatchStatus): Promise<Match> {
    const data = unwrap(await supabase.from('matches').update({ status }).eq('id', id).select(MATCH_COLUMNS).single()) as unknown as Match | null
    if (!data) throw new AppError(toFriendlyMessage(null))
    return data
  },

  /** Uploads an announcement image and returns its storage path. */
  async uploadImage(file: File): Promise<string> {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type })
    if (error) throw new AppError('Could not upload the image. Use a JPG, PNG or WebP under 2 MB.')
    return path
  },

  /** Best-effort removal of an image nobody references any more. Never throws. */
  async deleteImage(path: string | null | undefined): Promise<void> {
    if (!path) return
    await supabase.storage.from(IMAGE_BUCKET).remove([path]).catch(() => undefined)
  },

  imageUrl(path: string | null): string | null {
    return path ? supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl : null
  },
}
