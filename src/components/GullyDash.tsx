import { useEffect, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brand } from '@/config/brand'
import { useAuth } from '@/hooks/useAuth'
import { ballHeight, hitWindow, loadBest, makeDelivery, milestone, runsForTiming, saveBest, strikeRate, type Delivery } from '@/utils/gullyDash'
import { shareOrDownloadImage } from '@/utils/upiImage'

// Logical size; the canvas is scaled to the screen.
const W = 480
const H = 270
const GROUND = 200
const SWEET = 110 // where the ball meets the bat
const STUMPS = 50
const BALL_BASE = GROUND - 6
const HAND = { x: 86, y: 156 }
const BAT_LEN = 44
const BAT_REST = -1.9
const BAT_THROUGH = 0.9

type Phase = 'ready' | 'playing' | 'over'
type BallState = 'incoming' | 'hit' | 'gap'

interface Game {
  phase: Phase
  score: number
  faced: number
  fours: number
  sixes: number
  best: number
  ball: { state: BallState; x: number; y: number; vx: number; vy: number; t: number; plan: Delivery; paced: boolean }
  next: Delivery // the ball being bowled after the current wait
  swingT: number // seconds since the swing started, -1 when idle
  gap: number
  popup: { text: string; t: number } | null
  celebration: { text: string; t: number } | null // fifty / century banner
  confetti: Confetti[]
  reason: string
  overAt: number
  player: string
}

interface Confetti {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  spin: number
  angle: number
}

const CELEBRATION_SECONDS = 2.6
const CONFETTI_COLORS = [brand.themeColor, '#facc15', '#ef4444', '#3b82f6', '#ec4899', '#f97316']

/** A burst of confetti shooting up from behind the banner. Skipped for people who ask for less motion. */
function burstConfetti(): Confetti[] {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return []
  return Array.from({ length: 90 }, (_, i) => ({
    x: W / 2 + (Math.random() - 0.5) * 120,
    y: 110,
    vx: (Math.random() - 0.5) * 420,
    vy: -150 - Math.random() * 330,
    size: 4 + Math.random() * 5,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    spin: (Math.random() - 0.5) * 14,
    angle: Math.random() * Math.PI,
  }))
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function batAngle(swingT: number): number {
  if (swingT < 0) return BAT_REST
  if (swingT < 0.15) return lerp(BAT_REST, BAT_THROUGH, swingT / 0.15)
  if (swingT < 0.4) return BAT_THROUGH
  return lerp(BAT_THROUGH, BAT_REST, Math.min(1, (swingT - 0.4) / 0.1))
}

/** A new ball from the bowler: vx is its speed in px/s towards the bat, which changes only if the plan has a change of pace. */
function bowl(plan: Delivery): Game['ball'] {
  return { state: 'incoming', x: W + 10, y: BALL_BASE, vx: plan.speed, vy: 0, t: 0, plan, paced: false }
}

function newGame(best: number): Game {
  const first = makeDelivery(0)
  return {
    phase: 'ready',
    score: 0,
    faced: 0,
    fours: 0,
    sixes: 0,
    best,
    ball: { ...bowl(first), state: 'gap' },
    next: first,
    swingT: -1,
    gap: 0,
    popup: null,
    celebration: null,
    confetti: [],
    reason: '',
    overAt: 0,
    player: 'Anonymous',
  }
}

/** End-of-innings card: runs, balls, fours, sixes, strike rate and how the batter got out. This is also what gets shared as the picture. */
function drawScorecard(ctx: CanvasRenderingContext2D, g: Game) {
  const x = 50
  const y = 42
  const w = W - 100
  const h = 152
  const balls = g.faced + 1 // the ball that got you out counts as faced
  const clean = g.reason.replace(/!$/, '')

  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.3)'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 10)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = brand.themeColor
  ctx.beginPath()
  ctx.roundRect(x, y, w, 28, [10, 10, 0, 0])
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.fillText('SCORECARD', W / 2, y + 15)

  const stats: [string, string][] = [
    ['RUNS', String(g.score)],
    ['BALLS', String(balls)],
    ['4s', String(g.fours)],
    ['6s', String(g.sixes)],
    ['S/R', strikeRate(g.score, balls)],
  ]
  const col = w / stats.length
  stats.forEach(([label, value], i) => {
    const cx = x + col * i + col / 2
    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${i === 0 ? 32 : 24}px system-ui, sans-serif`
    ctx.fillText(value, cx, y + 62)
    ctx.fillStyle = '#64748b'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.fillText(label, cx, y + 90)
  })

  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(x + 16, y + 106, w - 32, 1)
  ctx.fillStyle = '#b91c1c'
  ctx.font = 'bold 16px system-ui, sans-serif'
  ctx.fillText(`OUT  -  ${clean}`, W / 2, y + 122)
  ctx.fillStyle = '#64748b'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('Tap to bat again', W / 2, y + 141)
  ctx.textBaseline = 'top'
}

function draw(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.clearRect(0, 0, W, H)
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
  sky.addColorStop(0, '#dff3ff')
  sky.addColorStop(1, '#f7fbff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, GROUND)
  ctx.fillStyle = brand.themeColor
  ctx.fillRect(0, GROUND, W, H - GROUND)
  ctx.fillStyle = '#d9c28f' // the pitch
  ctx.fillRect(20, GROUND, W - 20, 14)

  // stumps
  ctx.fillStyle = '#f5e6c8'
  for (const x of [STUMPS - 6, STUMPS, STUMPS + 6]) ctx.fillRect(x - 1.5, GROUND - 38, 3, 38)
  ctx.fillRect(STUMPS - 8, GROUND - 40, 7, 2)
  ctx.fillRect(STUMPS + 1, GROUND - 40, 7, 2)

  // batter
  ctx.strokeStyle = '#1e293b'
  ctx.fillStyle = '#1e293b'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(84, 138, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(84, 148)
  ctx.lineTo(84, 176)
  ctx.moveTo(84, 176)
  ctx.lineTo(77, GROUND)
  ctx.moveTo(84, 176)
  ctx.lineTo(92, GROUND)
  ctx.moveTo(84, 154)
  ctx.lineTo(HAND.x, HAND.y)
  ctx.stroke()
  const a = batAngle(g.swingT)
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(HAND.x, HAND.y)
  ctx.lineTo(HAND.x + BAT_LEN * Math.cos(a), HAND.y + BAT_LEN * Math.sin(a))
  ctx.stroke()

  // ball (hidden between deliveries)
  if (g.phase === 'playing' && g.ball.state !== 'gap') {
    const alpha = g.ball.state === 'hit' ? Math.max(0, 1 - g.ball.t / 0.8) : 1
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.arc(g.ball.x, g.ball.y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`Runs ${g.score}`, 12, 10)
  // The ball that got you out counts as faced, like on a scorecard.
  ctx.fillStyle = '#475569'
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillText(`Balls ${g.faced + (g.phase === 'over' ? 1 : 0)}`, 12, 34)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 20px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`Best ${g.best}`, W - 12, 10)
  // Drawn on the canvas so the name shows up in screenshots people share.
  ctx.textAlign = 'center'
  ctx.fillStyle = '#475569'
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText(g.player.length > 18 ? `${g.player.slice(0, 17)}…` : g.player, W / 2, 13)
  ctx.fillStyle = '#0f172a'

  if (g.popup) {
    ctx.globalAlpha = Math.max(0, 1 - g.popup.t / 0.9)
    ctx.fillStyle = brand.themeColor
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(g.popup.text, SWEET + 60, 70 - g.popup.t * 30)
    ctx.globalAlpha = 1
  }

  if (g.phase === 'ready') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
    ctx.fillRect(0, 70, W, 110)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillText('Gully Dash', W / 2, 84)
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText('Tap when the ball reaches your bat', W / 2, 124)
    ctx.fillText('Closer to the middle of the bat = more runs', W / 2, 148)
  }
  if (g.phase === 'over') drawScorecard(ctx, g)

  for (const c of g.confetti) {
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(c.angle)
    ctx.fillStyle = c.color
    ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2)
    ctx.restore()
  }

  if (g.celebration) {
    const t = g.celebration.t
    const grow = Math.min(1, t / 0.25) // pops in
    const fade = Math.min(1, (CELEBRATION_SECONDS - t) / 0.5) // fades out at the end
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.translate(W / 2, 110)
    ctx.scale(0.5 + 0.5 * grow + 0.06 * Math.sin(t * 8), 0.5 + 0.5 * grow + 0.06 * Math.sin(t * 8))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 54px system-ui, sans-serif'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 8
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(g.celebration.text, 0, 0)
    ctx.fillStyle = brand.themeColor
    ctx.fillText(g.celebration.text, 0, 0)
    ctx.restore()
  }
}

/** One-button timing game: tap as the ball reaches the bat. Keeps its best score on the device only. */
export function GullyDash() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('')
  const [finished, setFinished] = useState(false) // true once the batter is out
  const [note, setNote] = useState('')
  const { profile } = useAuth()
  // The game loop runs once; it reads the name from a ref so a profile that loads late still shows.
  const playerRef = useRef('Anonymous')
  playerRef.current = profile?.full_name?.trim() || 'Anonymous'

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const g = newGame(loadBest())

    function finish(reason: string) {
      g.phase = 'over'
      g.reason = reason
      g.overAt = performance.now()
      if (g.score > g.best) {
        g.best = g.score
        saveBest(g.best)
      }
      setStatus(`Out! ${reason} You scored ${g.score}.`)
      setFinished(true)
    }

    function start() {
      g.phase = 'playing'
      g.score = 0
      g.faced = 0
      g.fours = 0
      g.sixes = 0
      g.swingT = -1
      g.popup = null
      g.celebration = null
      g.confetti = []
      g.ball = bowl(makeDelivery(0))
      setStatus('')
      setFinished(false)
      setNote('')
    }

    function act() {
      if (g.phase === 'ready') return start()
      if (g.phase === 'over') {
        if (performance.now() - g.overAt > 400) start() // ignore the tap that was still swinging when you got out
        return
      }
      if (g.ball.state !== 'incoming') return
      const offset = g.ball.x - SWEET
      const runs = runsForTiming(offset, hitWindow(g.faced))
      g.swingT = 0
      if (runs === null) return finish(offset > 0 ? 'Too early!' : 'Too late!')
      const cheer = milestone(g.score, g.score + runs)
      g.score += runs
      g.faced += 1
      if (runs === 4) g.fours += 1
      if (runs === 6) g.sixes += 1
      if (cheer) {
        g.celebration = { text: cheer, t: 0 }
        g.confetti = burstConfetti()
      }
      g.popup = { text: runs === 6 ? 'SIX!' : runs === 4 ? 'FOUR!' : String(runs), t: 0 }
      const fly = { 6: [200, -380], 4: [380, -90], 2: [150, -60], 1: [90, -30] }[runs] ?? [90, -30]
      g.ball = { ...g.ball, state: 'hit', x: SWEET, vx: fly[0], vy: fly[1], t: 0 }
    }

    function update(dt: number) {
      if (g.popup) {
        g.popup.t += dt
        if (g.popup.t > 0.9) g.popup = null
      }
      if (g.celebration) {
        g.celebration.t += dt
        if (g.celebration.t > CELEBRATION_SECONDS) g.celebration = null
      }
      for (const c of g.confetti) {
        c.vy += 520 * dt
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.angle += c.spin * dt
      }
      if (g.confetti.length > 0) g.confetti = g.confetti.filter((c) => c.y < H + 20)
      if (g.swingT >= 0) {
        g.swingT += dt
        if (g.swingT > 0.5) g.swingT = -1
      }
      if (g.phase !== 'playing') return
      const b = g.ball
      if (b.state === 'incoming') {
        b.x -= b.vx * dt
        if (b.plan.paceChange && !b.paced && b.x - SWEET < b.plan.paceChange.at) {
          b.paced = true
          b.vx *= b.plan.paceChange.factor
        }
        b.y = BALL_BASE - ballHeight(b.x - SWEET, b.plan.pitches)
        if (b.x < STUMPS + 8) finish('Bowled!')
      } else if (b.state === 'hit') {
        b.t += dt
        b.vy += 500 * dt
        b.x += b.vx * dt
        b.y = Math.min(BALL_BASE, b.y + b.vy * dt)
        if (b.t > 0.8) {
          b.state = 'gap'
          g.next = makeDelivery(g.faced)
          g.gap = g.next.wait
        }
      } else {
        g.gap -= dt
        if (g.gap <= 0) g.ball = bowl(g.next)
      }
    }

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      g.player = playerRef.current
      update(dt)
      draw(ctx!, g)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function onKey(e: KeyboardEvent) {
      if (e.code !== 'Space' || e.repeat) return
      // Space must keep working for buttons, links and fields on the page.
      if ((e.target as HTMLElement | null)?.closest?.('button, a, input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      act()
    }
    function onPointer(e: PointerEvent) {
      e.preventDefault()
      act()
    }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onPointer)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  /** Sends a picture of the game as it is now (name, runs, balls and the "Out!" banner). Saves it as a file where sharing is not available. */
  async function shareScore() {
    const canvas = canvasRef.current
    if (!canvas) return
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return setNote('Could not create the picture. Please take a screenshot instead.')
    const result = await shareOrDownloadImage(blob, 'gully-dash-score.png')
    setNote(result === 'downloaded' ? 'Picture saved. Send it from your gallery or downloads.' : '')
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Gully Dash cricket game. Tap or press Space to hit the ball as it reaches the bat."
        className="w-full cursor-pointer select-none rounded-lg border border-slate-200 bg-white"
        style={{ aspectRatio: `${W} / ${H}`, touchAction: 'manipulation' }}
      />
      {finished ? (
        <div className="flex flex-col items-center gap-1">
          <Button onClick={shareScore}>
            <Share2 className="size-4" aria-hidden /> Share score
          </Button>
          {note && <p className="text-center text-xs text-slate-500">{note}</p>}
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500">Tap, click or press Space to swing.</p>
      )}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
