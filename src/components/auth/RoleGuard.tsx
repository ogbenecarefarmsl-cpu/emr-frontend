import { useAuth } from '@/context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'receptionist' | 'lab_tech' | 'doctor' | 'specialist' | 'nurse' | 'pharmacist' | 'inventory_manager')[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, isLoading, roles, signOut, profile, primaryRole } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has any role assigned
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-status-warning/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-status-warning" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access Pending</h2>
          <p className="text-muted-foreground mb-6">
            Your account has been created, but an administrator needs to assign your role before you can access the system.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Logged in as: <span className="font-medium">{profile?.email}</span>
          </p>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Check specific role access if specified
  if (allowedRoles && !allowedRoles.some(role => roles.includes(role))) {
    const getDefaultRoute = () => {
      if (!primaryRole) return '/login';
      switch (primaryRole) {
        case 'admin': return '/admin';
        case 'doctor': return '/doctor';
        case 'specialist': return '/doctor';
        case 'nurse': return '/nurse';
        case 'pharmacist': return '/pharmacy';
        case 'lab_tech': return '/lab';
        case 'receptionist': return '/reception';
        case 'inventory_manager': return '/inventory';
        default: return '/login';
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-status-critical/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-status-critical" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this section.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Your role: <span className="font-medium">{primaryRole}</span>
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button onClick={() => navigate(getDefaultRoute())}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
