import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CancelledBadge, ListBadge, PaymentBadge } from '@/components/RegistrationBadges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced } from '@/hooks/useDebounced'
import { isResetOpen } from '@/utils/password'
import { TempPasswordDialog } from '@/components/TempPasswordDialog'
import { usePlayerCounts, usePlayerHistory, usePlayers, useSetPasswordReset, useSetRole, useSetStatus } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { PlayerSummary } from '@/types/domain'
import { formatShortDate } from '@/utils/dates'

function History({ userId }: { userId: string }) {
  const { data, isLoading, error } = usePlayerHistory(userId)
  if (isLoading) return <p className="px-3 pb-3 text-sm text-slate-500">Loading history...</p>
  if (error) {
    return (
      <p role="alert" className="px-3 pb-3 text-sm text-red-600">
        {toFriendlyMessage(error)}
      </p>
    )
  }
  if (!data || data.length === 0) return <p className="px-3 pb-3 text-sm text-slate-500">No registrations yet.</p>
  return (
    <ul className="divide-y divide-slate-100 border-t border-slate-100">
      {data.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <Link to={`/admin/matches/${r.match.id}`} className="font-medium hover:underline">
            {formatShortDate(r.match.match_date)} · {r.match.title}
          </Link>
          <span className="flex flex-wrap items-center gap-2">
            {r.status === 'ACTIVE' ? <ListBadge listType={r.list_type} position={r.list_position} /> : <CancelledBadge />}
            {r.match.registration_fee > 0 && <PaymentBadge status={r.payment_status} />}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PlayersPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'BLOCKED'>('ALL')
  const search = useDebounced(query, 300)
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData } = usePlayers({
    query: search,
    status: filter === 'ALL' ? null : filter,
  })
  const { data: counts } = usePlayerCounts()
  const [openId, setOpenId] = useState<string | null>(null)
  const { session } = useAuth()
  const setRole = useSetRole()
  const [roleChange, setRoleChange] = useState<PlayerSummary | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const setStatus = useSetStatus()
  const setPasswordReset = useSetPasswordReset()
  const [blocking, setBlocking] = useState<PlayerSummary | null>(null)
  const [tempFor, setTempFor] = useState<PlayerSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [blockError, setBlockError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(toFriendlyMessage(e))
    }
  }

  if (isLoading) return <p className="text-slate-500">Loading players...</p>
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-red-600">
          {toFriendlyMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const players = data?.pages.flatMap((p) => p.players) ?? []
  const total = data?.pages[0]?.total ?? 0
  const pendingCount = counts?.pending ?? 0
  const resetOpen = (p: PlayerSummary) => isResetOpen(p.password_reset_until)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Players</h1>
      <Input aria-label="Search players" placeholder="Search by name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter players">
        {(['ALL', 'PENDING', 'BLOCKED'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'All' : f === 'PENDING' ? `Pending approval (${pendingCount})` : `Blocked${counts ? ` (${counts.blocked})` : ''}`}
          </Button>
        ))}
      </div>
      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}
      {players.length === 0 ? (
        <p className="text-slate-500">No players found.</p>
      ) : (
        <div className={`space-y-2 ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {players.map((p) => (
            <Card key={p.id} className="p-0">
              <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.full_name}</span>
                    {p.role === 'ADMIN' && <Badge className="bg-blue-100 text-blue-800">Admin</Badge>}
                    {p.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-800">Pending approval</Badge>}
                    {p.status === 'BLOCKED' && <Badge className="bg-red-100 text-red-800">Blocked</Badge>}
                    {resetOpen(p) && <Badge className="bg-slate-100 text-slate-700">Reset link on</Badge>}
                  </div>
                  <div className="text-sm text-slate-600">
                    {p.phone ?? 'No phone'} · {p.registration_count} registration{p.registration_count === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.id !== session?.user.id && (p.status === 'PENDING' || p.status === 'BLOCKED') && (
                    <Button size="sm" disabled={setStatus.isPending} onClick={() => run(() => setStatus.mutateAsync({ userId: p.id, status: 'ACTIVE' }))}>
                      {p.status === 'PENDING' ? 'Approve' : 'Unblock'}
                    </Button>
                  )}
                  {p.id !== session?.user.id && p.status !== 'BLOCKED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBlockError(null)
                        setBlocking(p)
                      }}
                    >
                      {p.status === 'PENDING' ? 'Reject' : 'Block'}
                    </Button>
                  )}
                  {p.id !== session?.user.id && p.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant={p.role === 'ADMIN' ? 'outline' : 'default'}
                      onClick={() => {
                        setRoleError(null)
                        setRoleChange(p)
                      }}
                    >
                      {p.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
                    </Button>
                  )}
                  {p.id !== session?.user.id && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setTempFor(p)}>
                        Set password
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={setPasswordReset.isPending}
                        onClick={() => run(() => setPasswordReset.mutateAsync({ userId: p.id, enabled: !resetOpen(p) }))}
                      >
                        {resetOpen(p) ? 'Turn off reset link' : 'Allow reset link'}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" aria-expanded={openId === p.id} onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                    {openId === p.id ? 'Hide history' : 'View history'}
                  </Button>
                </div>
              </div>
              {openId === p.id && <History userId={p.id} />}
            </Card>
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-slate-500" aria-live="polite">
            Showing {players.length} of {total}
          </p>
          {hasNextPage && (
            <Button variant="outline" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading...' : 'Show more'}
            </Button>
          )}
        </div>
      )}

      <TempPasswordDialog key={tempFor?.id ?? 'none'} player={tempFor} onClose={() => setTempFor(null)} />

      <ConfirmDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        title={blocking?.status === 'PENDING' ? `Reject ${blocking.full_name}?` : `Block ${blocking?.full_name}?`}
        description="They will be signed out and cannot log in or register for matches. Their past registrations stay. You can unblock them later."
        confirmLabel={blocking?.status === 'PENDING' ? 'Reject' : 'Block'}
        loadingLabel="Updating..."
        destructive
        loading={setStatus.isPending}
        error={blockError}
        onConfirm={async () => {
          if (!blocking || setStatus.isPending) return
          setBlockError(null)
          try {
            await setStatus.mutateAsync({ userId: blocking.id, status: 'BLOCKED' })
            setBlocking(null)
          } catch (e) {
            setBlockError(toFriendlyMessage(e))
          }
        }}
      />

      <ConfirmDialog
        open={!!roleChange}
        onOpenChange={(o) => !o && setRoleChange(null)}
        title={roleChange?.role === 'ADMIN' ? `Remove admin rights from ${roleChange.full_name}?` : `Make ${roleChange?.full_name} an admin?`}
        description={
          roleChange?.role === 'ADMIN'
            ? 'They will become a regular player and lose access to the admin pages.'
            : 'Admins can create and manage matches, see all players’ phone numbers, record payments and expenses, and make other people admins.'
        }
        confirmLabel={roleChange?.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
        loadingLabel="Updating..."
        destructive={roleChange?.role === 'ADMIN'}
        loading={setRole.isPending}
        error={roleError}
        onConfirm={async () => {
          if (!roleChange || setRole.isPending) return
          setRoleError(null)
          try {
            await setRole.mutateAsync({ userId: roleChange.id, role: roleChange.role === 'ADMIN' ? 'USER' : 'ADMIN' })
            setRoleChange(null)
          } catch (e) {
            setRoleError(toFriendlyMessage(e))
          }
        }}
      />
    </div>
  )
}
