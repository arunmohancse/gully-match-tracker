import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** Shown for any address that doesn't exist, e.g. a mistyped link. Works logged in or out. */
export function NotFoundPage() {
  return (
    <Card className="space-y-3">
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="text-slate-600">This page doesn&apos;t exist. The link may be mistyped or out of date.</p>
      <Button asChild>
        <Link to="/">Go to home</Link>
      </Button>
    </Card>
  )
}
