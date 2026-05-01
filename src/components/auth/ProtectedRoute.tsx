import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, isLoading, profile } = useAuth();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const loc = useLocation();

  if (isLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  if (profile?.is_blocked) {
    return <Navigate to="/login" replace state={{ blocked: true }} />;
  }

  if (settings.maintenance_mode && !isAdmin) {
    return <Navigate to="/maintenance" replace />;
  }

  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
