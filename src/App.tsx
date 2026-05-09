import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/authStore";

import { AuthProvider } from "@/contexts/AuthContext";
import { CatalogProvider } from "@/contexts/CatalogContext";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StudentLayout } from "@/components/layout/StudentLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";

import { PublicShell } from "@/components/public/PublicShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/ui/PageLoader";
import { SkipLink } from "@/components/a11y/SkipLink";
import { LiveRegion } from "@/components/a11y/LiveRegion";
import { RouteAnalytics } from "@/components/seo/RouteAnalytics";

function AuthManager() {
  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.getState().hydrate();
    };
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const store = useAuthStore.getState();
        
        if (event === 'SIGNED_OUT') {
          store.logout();
        } else if (session?.user) {
          store.setUser(session.user);
          store.setSession(session);
          
          // Refresh profile on sign in
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            try {
              const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
              store.setProfile(data);
            } catch (err) {
               console.warn("Could not fetch profile during auth event", err);
            }
          }
        } else {
          store.logout(); // Fallback if no session
        }
        
        // We only set loading false if we aren't already handling a hydrate
        // hydrate() natively sets isLoading to false when done.
        // We can ensure we don't accidentally stop the loading spinner too early.
        if (event !== 'INITIAL_SESSION') {
          store.setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

import { OfflineBanner } from "@/components/OfflineBanner";
import { UpdateToast } from "@/components/UpdateToast";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const SignupPage = lazy(() => import("./pages/auth/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));

const AboutPage = lazy(() => import("./pages/public/AboutPage"));
const ContactPage = lazy(() => import("./pages/public/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/public/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/public/TermsPage"));
const RefundPolicyPage = lazy(() => import("./pages/public/RefundPolicyPage"));
const SuccessStoriesPage = lazy(() => import("./pages/public/SuccessStoriesPage"));
const PricingPage = lazy(() => import("./pages/public/PricingPage"));

const DashboardPage = lazy(() => import("./pages/student/DashboardPage"));
const SubjectPage = lazy(() => import("./pages/student/SubjectPage"));
const CoursesPage = lazy(() => import("./pages/student/CoursesPage"));
const ChaptersPage = lazy(() => import("./pages/student/ChaptersPage"));
const VideoListPage = lazy(() => import("./pages/student/VideoListPage"));
const PlayerPage = lazy(() => import("./pages/student/PlayerPage"));
const SearchPage = lazy(() => import("./pages/student/SearchPage"));
const NotificationsPage = lazy(() => import("./pages/student/NotificationsPage"));
const LivePage = lazy(() => import("./pages/student/LivePage"));
const ProgressPage = lazy(() => import("./pages/student/ProgressPage"));
const ProfilePage = lazy(() => import("./pages/student/ProfilePage"));
const NotesPage = lazy(() => import("./pages/student/NotesPage"));
const ResourcesPage = lazy(() => import("./pages/student/ResourcesPage"));
const EnrollmentPage = lazy(() => import("./pages/student/EnrollmentPage"));

const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminContentPage = lazy(() => import("./pages/admin/AdminContentPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/admin/AdminAnnouncementsPage"));
const AdminLivePage = lazy(() => import("./pages/admin/AdminLivePage"));
const AdminLogsPage = lazy(() => import("./pages/admin/AdminLogsPage"));
const AdminSystemPage = lazy(() => import("./pages/admin/AdminSystemPage"));
const AdminEnrollmentPage = lazy(() => import("./pages/admin/AdminEnrollmentPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const AppContent = () => {
  const isLoading = useAuthStore(state => state.isLoading);
  
  // NEVER show infinite loading — useAuthStore hydrate has a 5s timeout
  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route element={<PublicShell />}>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingPage />} />
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
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/enrollment" element={<EnrollmentPage />} />
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
    </Suspense>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SystemSettingsProvider>
        <TooltipProvider>
          <OfflineBanner />
          <UpdateToast />
          <Toaster />
          <Sonner />
          <AuthManager />
          <BrowserRouter>
            <RouteAnalytics />
            <SkipLink />
            <LiveRegion />
            <AuthProvider>
              <CatalogProvider>
                <AppContent />
              </CatalogProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </SystemSettingsProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
