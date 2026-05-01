import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider } from "@/contexts/AuthContext";
import { CatalogProvider } from "@/contexts/CatalogContext";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";

import { PublicShell } from "@/components/public/PublicShell";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/MaintenancePage";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

import AboutPage from "./pages/public/AboutPage";
import ContactPage from "./pages/public/ContactPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";
import RefundPolicyPage from "./pages/public/RefundPolicyPage";
import SuccessStoriesPage from "./pages/public/SuccessStoriesPage";

import DashboardPage from "./pages/student/DashboardPage";
import SubjectPage from "./pages/student/SubjectPage";
import CoursesPage from "./pages/student/CoursesPage";
import ChaptersPage from "./pages/student/ChaptersPage";
import VideoListPage from "./pages/student/VideoListPage";
import PlayerPage from "./pages/student/PlayerPage";
import SearchPage from "./pages/student/SearchPage";
import NotificationsPage from "./pages/student/NotificationsPage";
import LivePage from "./pages/student/LivePage";
import ProgressPage from "./pages/student/ProgressPage";
import ProfilePage from "./pages/student/ProfilePage";
import NotesPage from "./pages/student/NotesPage";

import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminAnnouncementsPage from "./pages/admin/AdminAnnouncementsPage";
import AdminLivePage from "./pages/admin/AdminLivePage";
import AdminLogsPage from "./pages/admin/AdminLogsPage";
import AdminSystemPage from "./pages/admin/AdminSystemPage";
import AdminEnrollmentPage from "./pages/admin/AdminEnrollmentPage";

import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SystemSettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <CatalogProvider>
                <Routes>
                  {/* Public */}

                <Route element={<PublicShell />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/refund-policy" element={<RefundPolicyPage />} />
                  <Route path="/success-stories" element={<SuccessStoriesPage />} />
                </Route>

                {/* Auth */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/maintenance" element={<MaintenancePage />} />

                {/* Student app */}
                <Route element={<ProtectedRoute><StudentLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/courses" element={<CoursesPage />} />
                  <Route path="/subject/:subjectSlug" element={<SubjectPage />} />
                  <Route path="/cycle/:cycleId" element={<ChaptersPage />} />
                  <Route path="/chapter/:chapterId" element={<VideoListPage />} />
                  <Route path="/watch/:videoId" element={<PlayerPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/live" element={<LivePage />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/notes" element={<NotesPage />} />
                </Route>

                {/* Admin */}
                <Route element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/content" element={<AdminContentPage />} />
                  <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
                  <Route path="/admin/live" element={<AdminLivePage />} />
                  <Route path="/admin/logs" element={<AdminLogsPage />} />
                  <Route path="/admin/system" element={<AdminSystemPage />} />
                  <Route path="/admin/enrollment" element={<AdminEnrollmentPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </CatalogProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </SystemSettingsProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
