import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, DollarSign, MinusCircle, Gauge, Archive, Users, Lock, Shield, Bot, Gift, LogOut, Menu, X, Zap, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', icon: Home, label: 'Bosh sahifa' },
  { path: '/dashboard/finance', icon: DollarSign, label: 'Moliya' },
  { path: '/dashboard/expenses', icon: MinusCircle, label: 'Xarajatlar' },
  { path: '/dashboard/meter', icon: Gauge, label: 'Hisoblagich' },
  { path: '/dashboard/archive', icon: Archive, label: 'Arxiv' },
  { path: '/dashboard/workers', icon: Users, label: 'Ishchilar' },
  { path: '/dashboard/plomba', icon: Lock, label: 'Plomba' },
  { path: '/dashboard/referrals', icon: Gift, label: 'Referallar' },
  { path: '/dashboard/security', icon: Shield, label: 'Xavfsizlik' },
  { path: '/dashboard/ai', icon: Bot, label: 'AI yordamchi' },
];

export default function DashboardLayout() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const isActive = (path: string) => location.pathname === path;
  const stationName = company?.stations?.[0] || company?.name || '';

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-foreground">BAREL<span className="text-primary">.uz</span></span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-secondary hover:translate-x-0.5"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-muted-foreground">Foydalanuvchi</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}
      <aside className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">BAREL<span className="text-primary">.uz</span></span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive(item.path)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-foreground hover:text-primary">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-foreground truncate">{stationName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">{user?.role === 'BOSS' ? '👑 Boss' : '👷 Ishchi'}</span>
            <span className="text-xs bg-secondary text-foreground px-2 py-1 rounded-md font-medium">{company?.plan}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
