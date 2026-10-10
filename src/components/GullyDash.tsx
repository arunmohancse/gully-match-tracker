import { useEffect, useRef, useState } from 'react'
import { brand } from '@/config/brand'
import { deliverySpeed, hitWindow, loadBest, runsForTiming, saveBest } from '@/utils/gullyDash'

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
const PITCH_PERIOD = 160

type Phase = 'ready' | 'playing' | 'over'
type BallState = 'incoming' | 'hit' | 'gap'

interface Game {
  phase: Phase
  score: number
  faced: number
  best: number
  ball: { state: BallState; x: number; y: number; vx: number; vy: number; t: number }
  swingT: number // seconds since the swing started, -1 when idle
  gap: number
  popup: { text: string; t: number } | null
  reason: string
  overAt: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function batAngle(swingT: number): number {
  if (swingT < 0) return BAT_REST
  if (swingT < 0.15) return lerp(BAT_REST, BAT_THROUGH, swingT / 0.15)
  if (swingT < 0.4) return BAT_THROUGH
  return lerp(BAT_THROUGH, BAT_REST, Math.min(1, (swingT - 0.4) / 0.1))
}

/** Height of the ball above its resting line: it bounces on the way in, then rolls along the ground past the bat. */
function bounce(x: number): number {
  if (x <= SWEET) return 0
  return 60 * Math.abs(Math.sin(((x - SWEET) / PITCH_PERIOD) * Math.PI))
}

function newGame(best: number): Game {
  return {
    phase: 'ready',
    score: 0,
    faced: 0,
    best,
    ball: { state: 'gap', x: W + 10, y: BALL_BASE, vx: 0, vy: 0, t: 0 },
    swingT: -1,
    gap: 0,
    popup: null,
    reason: '',
    overAt: 0,
  }
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
  ctx.textAlign = 'right'
  ctx.fillText(`Best ${g.best}`, W - 12, 10)

  if (g.popup) {
    ctx.globalAlpha = Math.max(0, 1 - g.popup.t / 0.9)
    ctx.fillStyle = brand.themeColor
    ctx.font = 'bold 34px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(g.popup.text, SWEET + 60, 70 - g.popup.t * 30)
    ctx.globalAlpha = 1
  }

  if (g.phase !== 'playing') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)'
    ctx.fillRect(0, 70, W, 110)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.fillText(g.phase === 'ready' ? 'Gully Dash' : `Out! ${g.reason}`, W / 2, 84)
    ctx.font = '18px system-ui, sans-serif'
    ctx.fillText(g.phase === 'ready' ? 'Tap when the ball reaches your bat' : `You scored ${g.score}. Tap to bat again`, W / 2, 124)
    if (g.phase === 'ready') ctx.fillText('Closer to the middle of the bat = more runs', W / 2, 148)
  }
}

/** One-button timing game: tap as the ball reaches the bat. Keeps its best score on the device only. */
export function GullyDash() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('')

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
    }

    function start() {
      g.phase = 'playing'
      g.score = 0
      g.faced = 0
      g.swingT = -1
      g.popup = null
      g.ball = { state: 'incoming', x: W + 10, y: BALL_BASE, vx: 0, vy: 0, t: 0 }
      setStatus('')
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
      g.score += runs
      g.faced += 1
      g.popup = { text: runs === 6 ? 'SIX!' : runs === 4 ? 'FOUR!' : String(runs), t: 0 }
      const fly = { 6: [200, -380], 4: [380, -90], 2: [150, -60], 1: [90, -30] }[runs] ?? [90, -30]
      g.ball = { state: 'hit', x: SWEET, y: BALL_BASE, vx: fly[0], vy: fly[1], t: 0 }
    }

    function update(dt: number) {
      if (g.popup) {
        g.popup.t += dt
        if (g.popup.t > 0.9) g.popup = null
      }
      if (g.swingT >= 0) {
        g.swingT += dt
        if (g.swingT > 0.5) g.swingT = -1
      }
      if (g.phase !== 'playing') return
      const b = g.ball
      if (b.state === 'incoming') {
        b.x -= deliverySpeed(g.faced) * dt
        b.y = BALL_BASE - bounce(b.x)
        if (b.x < STUMPS + 8) finish('Bowled!')
      } else if (b.state === 'hit') {
        b.t += dt
        b.vy += 500 * dt
        b.x += b.vx * dt
        b.y = Math.min(BALL_BASE, b.y + b.vy * dt)
        if (b.t > 0.8) {
          b.state = 'gap'
          g.gap = 0.4
        }
      } else {
        g.gap -= dt
        if (g.gap <= 0) g.ball = { state: 'incoming', x: W + 10, y: BALL_BASE, vx: 0, vy: 0, t: 0 }
      }
    }

    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
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

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Gully Dash cricket game. Tap or press Space to hit the ball as it reaches the bat."
        className="w-full cursor-pointer select-none rounded-lg border border-slate-200 bg-white"
        style={{ aspectRatio: `${W} / ${H}`, touchAction: 'manipulation' }}
      />
      <p className="text-center text-xs text-slate-500">Tap, click or press Space to swing.</p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
