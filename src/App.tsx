import { QueryClientProvider } from '@tanstack/react-query'
import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RedirectIfAuthed, RequireAdmin, RequireAuth } from '@/components/RouteGuards'
import { AuthProvider } from '@/hooks/useAuth'
import { AppLayout } from '@/layouts/AppLayout'
import { ViewerLayout } from '@/layouts/ViewerLayout'
import { queryClient } from '@/lib/queryClient'
import { AboutPage } from '@/pages/AboutPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { SignupPage } from '@/pages/auth/SignupPage'

// Everything behind the login is loaded on demand, so the first screen stays small.
// The admin area in particular is never downloaded by ordinary players.
const PlayPage = lazy(() => import('@/pages/PlayPage').then((m) => ({ default: m.PlayPage })))
const MatchDetailPage = lazy(() => import('@/pages/MatchDetailPage').then((m) => ({ default: m.MatchDetailPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const DashboardPage = lazy(() => import('@/pages/user/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MatchesPage = lazy(() => import('@/pages/user/MatchesPage').then((m) => ({ default: m.MatchesPage })))
const MyRegistrationsPage = lazy(() => import('@/pages/user/MyRegistrationsPage').then((m) => ({ default: m.MyRegistrationsPage })))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const AdminMatchesPage = lazy(() => import('@/pages/admin/AdminMatchesPage').then((m) => ({ default: m.AdminMatchesPage })))
const AdminMatchFormPage = lazy(() => import('@/pages/admin/AdminMatchFormPage').then((m) => ({ default: m.AdminMatchFormPage })))
const AdminMatchPage = lazy(() => import('@/pages/admin/AdminMatchPage').then((m) => ({ default: m.AdminMatchPage })))
const PlayersPage = lazy(() => import('@/pages/admin/PlayersPage').then((m) => ({ default: m.PlayersPage })))
const PaymentsPage = lazy(() => import('@/pages/admin/PaymentsPage').then((m) => ({ default: m.PaymentsPage })))
const PaymentMatchPage = lazy(() => import('@/pages/admin/PaymentMatchPage').then((m) => ({ default: m.PaymentMatchPage })))
const ActivityPage = lazy(() => import('@/pages/admin/ActivityPage').then((m) => ({ default: m.ActivityPage })))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<RedirectIfAuthed />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Shareable match link: visible to everyone, including logged-out visitors. */}
            <Route element={<ViewerLayout />}>
              <Route path="about" element={<AboutPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="play" element={<PlayPage />} />
              <Route path="matches/:id" element={<MatchDetailPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="matches" element={<MatchesPage />} />
                <Route path="my-registrations" element={<MyRegistrationsPage />} />
                <Route path="profile" element={<ProfilePage />} />

                <Route path="admin" element={<RequireAdmin />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="matches" element={<AdminMatchesPage />} />
                  <Route path="matches/new" element={<AdminMatchFormPage />} />
                  <Route path="matches/:id" element={<AdminMatchPage />} />
                  <Route path="matches/:id/edit" element={<AdminMatchFormPage />} />
                  <Route path="players" element={<PlayersPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="payments/:matchId" element={<PaymentMatchPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
