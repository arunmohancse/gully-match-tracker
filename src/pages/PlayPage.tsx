import { GullyDash } from '@/components/GullyDash'

/** Public page for the mini game, so it can be shared in the WhatsApp group. */
export function PlayPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand">Gully Dash</h1>
        <p className="text-slate-600">Time your swing, hit the big ones and see how long you last.</p>
      </div>
      <GullyDash />
    </div>
  )
}
