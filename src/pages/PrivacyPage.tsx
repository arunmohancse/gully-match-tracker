import { Link } from 'react-router-dom'
import { brand } from '@/config/brand'

/** Public page, linked from the Google sign-in consent screen. */
export function PrivacyPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand">Privacy policy</h1>
      <p className="text-slate-700">
        {brand.fullName} is a small cricket community. This page explains what we keep about you when you use this site.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>Your name, email address and phone number (WhatsApp).</li>
          <li>If you sign in with Google, only the name and email address Google shares with us. We do not get your Google password, contacts or any other Google data.</li>
          <li>Your match registrations and payment status for match costs.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How we use it</h2>
        <ul className="list-disc space-y-1 pl-5 text-slate-700">
          <li>To let you log in and register for matches.</li>
          <li>To let the organisers contact you about matches and payments, for example by WhatsApp.</li>
          <li>To work out and track each player's share of match costs.</li>
        </ul>
        <p className="text-slate-700">We do not sell your data or use it for advertising.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Who can see it</h2>
        <p className="text-slate-700">
          Organisers (admins) can see players' names, phone numbers and payment status. Other players see only names on shared match lists. Your data is stored with our hosting providers
          (Supabase and Vercel) and is not shared with anyone else.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your choices</h2>
        <p className="text-slate-700">
          You can update your name and phone number on your Profile page. To have your account and data deleted, message us on Instagram
          {brand.instagram.handle ? (
            <>
              {' '}
              (
              <a href={brand.instagram.url} target="_blank" rel="noreferrer" className="font-medium text-brand underline">
                @{brand.instagram.handle}
              </a>
              )
            </>
          ) : null}{' '}
          and an organiser will remove it.
        </p>
      </section>

      <p className="text-center text-sm">
        <Link to="/about" className="font-medium text-brand underline">
          Back to About {brand.name}
        </Link>
      </p>
    </div>
  )
}
