import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getCurrentUser, setCurrentUser, clearSession,
  authenticate, getCompanyByKey, setCurrentCompanyKey,
  getCurrentCompanyKey, seedDemoData, type Company, type CompanyUser
} from '@/lib/store';
import { syncCompanyUsersToDb } from '@/lib/syncUsers';

interface AuthState {
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  isLooker: boolean;
  user: { login: string; role: string; name: string; companyKey: string } | null;
  company: Company | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => { success: boolean; error?: string; isSuperAdmin?: boolean; isLooker?: boolean };
  logout: () => void;
  refreshCompany: () => void;
  setLookerCompany: (companyKey: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    seedDemoData();
    const user = getCurrentUser();
    if (user) {
      const company = getCompanyByKey(user.companyKey);
      return { isLoggedIn: true, isSuperAdmin: false, user, company: company || null };
    }
    return { isLoggedIn: false, isSuperAdmin: false, user: null, company: null };
  });

  const refreshCompany = useCallback(() => {
    if (state.user) {
      const company = getCompanyByKey(state.user.companyKey);
      setState(prev => ({ ...prev, company: company || null }));
    }
  }, [state.user]);

  const login = useCallback((username: string, password: string) => {
    const result = authenticate(username, password);
    if (!result.success) {
      return { success: false, error: 'Login yoki parol noto\'g\'ri!' };
    }
    if (result.isSuperAdmin) {
      setState({ isLoggedIn: true, isSuperAdmin: true, user: { login: username, role: 'SUPERADMIN', name: 'Super Admin', companyKey: '' }, company: null });
      return { success: true, isSuperAdmin: true };
    }
    if (result.user && result.companyKey) {
      const userData = { login: result.user.login, role: result.user.role, name: result.user.name, companyKey: result.companyKey };
      setCurrentUser(userData);
      setCurrentCompanyKey(result.companyKey);
      const company = getCompanyByKey(result.companyKey);
      if (company) syncCompanyUsersToDb(company);
      setState({ isLoggedIn: true, isSuperAdmin: false, user: userData, company: company || null });
      return { success: true };
    }
    return { success: false, error: 'Xatolik yuz berdi' };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setState({ isLoggedIn: false, isSuperAdmin: false, user: null, company: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
