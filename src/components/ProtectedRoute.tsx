import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "admin" | "user";
}) {
  const { user, role, loading, signOut } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-secondary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (timedOut || !user) {
    // If loading timed out, sign out to clear stale session
    if (timedOut && user) {
      signOut();
    }
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
