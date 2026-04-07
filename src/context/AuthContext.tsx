import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import api, { ApiError, User, getToken, removeToken } from '../services/api';
import i18n from '../i18n';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/errorMessage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  isLoading: boolean;
  isAuthenticated: boolean;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  error: string | null;
  clearError: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'CLIENT' | 'FREELANCER';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_CACHE_KEY = 'freelancekg_user';

function loadCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function saveCachedUser(user: User | null): void {
  if (!user) {
    localStorage.removeItem(USER_CACHE_KEY);
    return;
  }

  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadCachedUser());
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>(() => loadCachedUser()?.permissions || []);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = getToken();
    if (!token) {
      setUser(null);
      saveCachedUser(null);
      return null;
    }

    try {
      const [userData, permissionsData] = await Promise.all([
        api.getMe(),
        api.getAuthPermissions().catch(() => null),
      ]);
      const resolvedPermissions = permissionsData?.permissions || [];
      const withPermissions: User = {
        ...userData,
        permissions: resolvedPermissions,
      };
      setPermissions(resolvedPermissions);
      setUser(withPermissions);
      saveCachedUser(withPermissions);
      return withPermissions;
    } catch (err) {
      if (isUnauthorizedError(err)) {
        removeToken();
        setPermissions([]);
        setUser(null);
        saveCachedUser(null);
      }

      throw err;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          await refreshUser();
        } catch {
          // Silent here to avoid noisy auth toasts on stale tokens.
        }
      } else {
        setUser(null);
        saveCachedUser(null);
      }
      setIsLoading(false);
    };

    void checkAuth();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.login({ email, password });
      const permissionsData = await api.getAuthPermissions().catch(() => null);
      const resolvedPermissions = permissionsData?.permissions || [];
      const withPermissions: User = {
        ...response.user,
        permissions: resolvedPermissions,
      };
      setPermissions(resolvedPermissions);
      setUser(withPermissions);
      saveCachedUser(withPermissions);
      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('auth.loginFailed', { defaultValue: 'Login failed' });
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.register(data);
      const permissionsData = await api.getAuthPermissions().catch(() => null);
      const resolvedPermissions = permissionsData?.permissions || [];
      const withPermissions: User = {
        ...response.user,
        permissions: resolvedPermissions,
      };
      setPermissions(resolvedPermissions);
      setUser(withPermissions);
      saveCachedUser(withPermissions);
      setIsLoading(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('auth.registerFailed', { defaultValue: 'Registration failed' });
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      const message = getErrorMessage(err, i18n.t('auth.logoutFailed', { defaultValue: 'Logout failed' }));
      setError(message);
      toast.error(message);
    } finally {
      setPermissions([]);
      setUser(null);
      saveCachedUser(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const hasPermission = useCallback(
    (permission: string): boolean => permissions.includes(permission),
    [permissions]
  );

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      refreshUser,
      isLoading,
      isAuthenticated: !!user,
      permissions,
      hasPermission,
      error,
      clearError,
    }),
    [clearError, error, hasPermission, isLoading, login, logout, permissions, refreshUser, register, user]
  );

  return (
    <AuthContext.Provider value={value}>
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
