import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { MatchList } from '@/components/MatchList'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { brand } from '@/config/brand'
import { about } from '@/config/about'
import { useAuth } from '@/hooks/useAuth'

/** Public page: who we are, how it works, and the upcoming matches. Works logged in or out. */
export function AboutPage() {
  const { session } = useAuth()

  return (
    <div className="space-y-8">
      <section className="space-y-4 text-center">
        <div className="flex justify-center">
          <BrandLogo className="size-24 rounded-none" />
        </div>
        <div>
          <h1 className="font-display text-5xl font-bold uppercase leading-none tracking-wide text-brand">{brand.name}</h1>
          {brand.subtitle && <p className="mt-1 text-sm font-bold uppercase tracking-[0.3em] text-subtle">{brand.subtitle}</p>}
        </div>
        <p className="mx-auto max-w-xl text-lg text-fg-2">{about.headline}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {session ? (
            <Button asChild size="lg">
              <Link to="/">Go to my dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to="/signup">Join the community</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">About us</h2>
        {about.intro.map((p) => (
          <p key={p} className="text-fg-2">
            {p}
          </p>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {about.steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-brand-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  {s.title}
                </div>
                <p className="text-sm text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Ground rules</h2>
        <ol className="list-decimal space-y-2 pl-5 text-fg-2">
          {about.rules.map((r) => (
            <li key={r.title}>
              <strong>{r.title}:</strong> {r.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Upcoming matches</h2>
        <MatchList scope="upcoming" basePath="/matches" actionLabel="View match" emptyText="No upcoming matches yet. Follow us to hear first." hideCancelled />
      </section>

      <p className="text-center text-sm">
        <Link to="/privacy" className="text-subtle hover:text-brand hover:underline">
          Privacy policy
        </Link>
      </p>
    </div>
  )
}
