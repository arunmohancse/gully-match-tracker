import { ChevronDown, ChevronRight, MessageCircle, MoreVertical, Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { buildWhatsAppChatUrl } from '@/utils/whatsapp'
import { CancelledBadge, ListBadge, PaymentBadge } from '@/components/RegistrationBadges'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAuth } from '@/hooks/useAuth'
import { useDebounced } from '@/hooks/useDebounced'
import { isResetOpen } from '@/utils/password'
import { ManagePlayerSheet } from '@/components/ManagePlayerSheet'
import { EditPhoneDialog } from '@/components/EditPhoneDialog'
import { PhoneRequestsCard } from '@/components/PhoneRequestsCard'
import { TempPasswordDialog } from '@/components/TempPasswordDialog'
import { usePlayerCounts, usePlayerHistory, usePlayers, useSetPasswordReset, useSetRole, useSetStatus } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { PlayerSummary } from '@/types/domain'
import { formatShortDate } from '@/utils/dates'
import { initials } from '@/utils/initials'
import { CricketLoader } from '@/components/CricketLoader'

function History({ userId }: { userId: string }) {
  const { data, isLoading, error } = usePlayerHistory(userId)
  if (isLoading) return <CricketLoader size="sm" label="Loading history" className="px-3 pb-3" />
  if (error) {
    return (
      <p role="alert" className="px-3 pb-3 text-sm text-danger">
        {toFriendlyMessage(error)}
      </p>
    )
  }
  if (!data || data.length === 0) return <p className="px-3 pb-3 text-sm text-subtle">No registrations yet.</p>
  return (
    <ul className="mx-3 mb-3 divide-y divide-line-soft rounded-xl bg-surface-2">
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

/** Opens a WhatsApp chat with the player so the admin can see which groups they still share. Nothing is sent unless the admin presses Send there. */
function WhatsAppButton({ player, label, iconOnly }: { player: PlayerSummary; label: string; iconOnly?: boolean }) {
  const url = player.phone ? buildWhatsAppChatUrl(player.phone) : null
  if (!url) return null
  return (
    <Button size="sm" variant="outline" className={iconOnly ? 'w-10 shrink-0 px-0 text-brand' : undefined} asChild>
      <a href={url} target="_blank" rel="noreferrer" aria-label={`${label}: ${player.full_name}`} title={iconOnly ? label : undefined}>
        <MessageCircle className="size-4" aria-hidden /> {!iconOnly && label}
      </a>
    </Button>
  )
}

const tag = 'px-1.5 text-[10px] uppercase tracking-wide'

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
  const [phoneFor, setPhoneFor] = useState<PlayerSummary | null>(null)
  const [managing, setManaging] = useState<PlayerSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [blockError, setBlockError] = useState<string | null>(null)

  function startBlock(p: PlayerSummary) {
    setBlockError(null)
    setBlocking(p)
  }

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(toFriendlyMessage(e))
    }
  }

  if (isLoading) return <CricketLoader label="Loading players" />
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-danger">
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
  // Admins come first from the database; show them as their own group.
  const groups = [
    { title: 'Admins', list: players.filter((p) => p.role === 'ADMIN') },
    { title: 'Players', list: players.filter((p) => p.role !== 'ADMIN') },
  ].filter((g) => g.list.length > 0)

  function playerRow(p: PlayerSummary) {
    const self = p.id === session?.user.id
    const open = openId === p.id
    return (
      <li key={p.id}>
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${p.full_name}: ${open ? 'hide' : 'show'} match history`}
            onClick={() => setOpenId(open ? null : p.id)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-sm font-extrabold text-brand" aria-hidden>
              {initials(p.full_name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-bold">{p.full_name}</span>
                {p.role === 'ADMIN' && <Badge className={cn(tag, 'bg-info-soft text-info')}>Admin</Badge>}
                {p.status === 'PENDING' && <Badge className={cn(tag, 'bg-warning-tint text-warning')}>Pending</Badge>}
                {p.status === 'BLOCKED' && <Badge className={cn(tag, 'bg-danger-tint text-danger')}>Blocked</Badge>}
                {resetOpen(p) && <Badge className={cn(tag, 'bg-surface-3 text-fg-2')}>Reset link on</Badge>}
              </span>
              <span className="block text-sm text-muted">
                {p.phone ?? (p.status === 'PENDING' ? <span className="font-semibold text-warning">No phone yet</span> : 'No phone')} · {p.registration_count} registration
                {p.registration_count === 1 ? '' : 's'}
              </span>
            </span>
            <ChevronDown className={cn('size-4 shrink-0 text-faint transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
          {!self && p.status === 'ACTIVE' && <WhatsAppButton player={p} label="WhatsApp" iconOnly />}
          {!self && (
            <Button size="sm" variant="ghost" className="w-10 shrink-0 px-0 text-subtle" onClick={() => setManaging(p)} aria-label={`Manage ${p.full_name}`} title="Manage">
              <MoreVertical className="size-5" aria-hidden />
            </Button>
          )}
        </div>
        {!self && p.status === 'PENDING' && (
          <div className="space-y-2 px-3 pb-3 sm:pl-[68px]">
            {!p.phone && (
              <p className="text-xs text-subtle">
                They haven't added a WhatsApp number yet, so you can't check them on WhatsApp or approve them. They are asked for it the next time they open the app.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={setStatus.isPending || !p.phone} onClick={() => run(() => setStatus.mutateAsync({ userId: p.id, status: 'ACTIVE' }))}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => startBlock(p)}>
                Reject
              </Button>
              <WhatsAppButton player={p} label="Check on WhatsApp" />
            </div>
          </div>
        )}
        {!self && p.status === 'BLOCKED' && (
          <div className="px-3 pb-3 sm:pl-[68px]">
            <Button size="sm" disabled={setStatus.isPending} onClick={() => run(() => setStatus.mutateAsync({ userId: p.id, status: 'ACTIVE' }))}>
              Unblock
            </Button>
          </div>
        )}
        {open && <History userId={p.id} />}
      </li>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Players" />
      <PhoneRequestsCard />
      {pendingCount > 0 && filter !== 'PENDING' && (
        <button
          type="button"
          onClick={() => setFilter('PENDING')}
          className="flex w-full items-center gap-3 rounded-2xl bg-warning-soft p-3 text-left text-warning hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <UserPlus className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">
              {pendingCount} {pendingCount === 1 ? 'player' : 'players'} waiting for approval
            </span>
            <span className="block text-sm font-semibold">Review and approve to let them register</span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </button>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input type="search" aria-label="Search players" placeholder="Search by name or phone" className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Segmented
        label="Filter players"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'ALL', label: 'All' },
          { value: 'PENDING', label: 'Pending', count: pendingCount },
          { value: 'BLOCKED', label: 'Blocked', count: counts?.blocked },
        ]}
      />
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
      {players.length === 0 ? (
        <p className="text-subtle">No players found.</p>
      ) : (
        <div className={cn('space-y-4', isPlaceholderData && 'opacity-60')}>
          {groups.map((g) => (
            <section key={g.title} className="space-y-2">
              {(groups.length > 1 || g.title === 'Admins') && <h2 className="px-1 text-xs font-extrabold uppercase tracking-wider text-subtle">{g.title}</h2>}
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                {g.list.map(playerRow)}
              </ul>
            </section>
          ))}
        </div>
      )}

      {players.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-subtle" aria-live="polite">
            Showing {players.length} of {total}
          </p>
          {hasNextPage && (
            <Button variant="outline" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading...' : 'Show more'}
            </Button>
          )}
        </div>
      )}

      <ManagePlayerSheet
        player={managing}
        resetOpen={managing ? resetOpen(managing) : false}
        busy={setStatus.isPending || setPasswordReset.isPending}
        onClose={() => setManaging(null)}
        onBlock={startBlock}
        onUnblock={(p) => run(() => setStatus.mutateAsync({ userId: p.id, status: 'ACTIVE' }))}
        onChangeRole={(p) => {
          setRoleError(null)
          setRoleChange(p)
        }}
        onSetPassword={setTempFor}
        onChangePhone={setPhoneFor}
        onToggleReset={(p) => run(() => setPasswordReset.mutateAsync({ userId: p.id, enabled: !resetOpen(p) }))}
      />

      <TempPasswordDialog key={tempFor?.id ?? 'none'} player={tempFor} onClose={() => setTempFor(null)} />
      <EditPhoneDialog key={phoneFor?.id ?? 'none'} player={phoneFor} onClose={() => setPhoneFor(null)} />

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
