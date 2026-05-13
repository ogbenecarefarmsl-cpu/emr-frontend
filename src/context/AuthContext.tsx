import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authAPI, getAccessToken, clearTokens } from '@/services/api';

export type AppRole = 'admin' | 'receptionist' | 'lab_tech' | 'doctor' | 'specialist' | 'nurse' | 'pharmacist' | 'inventory_manager';

export interface User {
  id: string;
  email: string;
  fullName: string;
  department?: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  department?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  primaryRole: AppRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = getAccessToken();
    if (token) {
      fetchUserProfile();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const data = await authAPI.getProfile();
      // Backend returns: { id, email, fullName, department, avatarUrl, roles, createdAt }
      const userData = {
        id: data.id,
        email: data.email,
        fullName: data.fullName,
        department: data.department,
        avatarUrl: data.avatarUrl,
        isActive: true,
      };
      setUser(userData);
      setProfile({
        id: data.id,
        email: data.email,
        full_name: data.fullName,
        department: data.department,
        avatar_url: data.avatarUrl,
      });
      setRoles(data.roles || []);
    } catch (error: unknown) {
      console.error('Error fetching user profile:', error);
      // Only clear tokens on authentication errors (401, 403)
      const axiosError = error as { response?: { status?: number } };
      const status = axiosError?.response?.status;
      if (status === 401 || status === 403) {
        clearTokens();
        setUser(null);
        setProfile(null);
        setRoles([]);
        if (window.location.pathname !== '/login') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      } else {
        // For other errors (network, server errors), keep the user logged in
        // but set loading to false so the app doesn't hang
        console.warn('Non-auth error fetching profile, keeping session');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authAPI.login(email, password);
      // Backend returns: { accessToken, refreshToken, user: { id, email, fullName, roles } }
      const userData = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        department: data.user.department,
        avatarUrl: data.user.avatarUrl,
        isActive: true,
      };
      setUser(userData);
      setProfile({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.fullName,
        department: data.user.department,
        avatar_url: data.user.avatarUrl,
      });
      setRoles(data.user.roles || []);
      return { error: null };
    } catch (error: unknown) {
      console.error('Login error:', error);
      const axiosError = error as { response?: { data?: { message?: string } }; message?: string };
      return { error: axiosError.response?.data?.message || axiosError.message || 'Login failed' };
    }
  };

  const signOut = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
      setUser(null);
      setProfile(null);
      setRoles([]);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const primaryRole = roles.length > 0
    ? (roles.includes('admin')
      ? 'admin'
      : roles.includes('doctor')
        ? 'doctor'
        : roles.includes('specialist')
          ? 'specialist'
          : roles.includes('nurse')
            ? 'nurse'
            : roles.includes('pharmacist')
              ? 'pharmacist'
              : roles.includes('inventory_manager')
                ? 'inventory_manager'
                : roles.includes('lab_tech')
                  ? 'lab_tech'
                  : 'receptionist')
    : null;

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      roles,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      hasRole,
      primaryRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
