import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home, DollarSign, MinusCircle, Gauge, Archive, Users, Lock, Shield, Bot, Gift, LogOut, Menu, X, Zap, Crown, Send, Sparkles, Vault, Bell, ShoppingCart, Package, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isRouteAllowed, type PlanKey } from '@/lib/helpers';
import { getActiveFeaturesByPlan, getTestingFeaturesByPlan, getCurrentStation, setCurrentStation } from '@/lib/store';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import ReminderNotifications from '@/components/ReminderNotifications';
import AnimatedBackground from '@/components/AnimatedBackground';

const allNavItems = [
  { path: '/dashboard', icon: Home, label: 'Bosh sahifa' },
  { path: '/dashboard/finance', icon: DollarSign, label: 'Moliya' },
  { path: '/dashboard/sales', icon: ShoppingCart, label: 'Sotuv', minPlan: 'STANDART' },
  { path: '/dashboard/expenses', icon: MinusCircle, label: 'Xarajatlar' },
  { path: '/dashboard/meter', icon: Gauge, label: 'Hisoblagich' },
  { path: '/dashboard/archive', icon: Archive, label: 'Arxiv' },
  { path: '/dashboard/workers', icon: Users, label: 'Ishchilar', minPlan: 'PRO' },
  { path: '/dashboard/plomba', icon: Lock, label: 'Plomba', minPlan: 'PRO' },
  { path: '/dashboard/referrals', icon: Gift, label: 'Referallar', minPlan: 'PREMIUM' },
  { path: '/dashboard/telegram', icon: Send, label: 'Telegram', minPlan: 'STANDART' },
  { path: '/dashboard/safe', icon: Vault, label: 'Seyf', minPlan: 'STANDART' },
  { path: '/dashboard/reminders', icon: Bell, label: 'Eslatmalar', minPlan: 'STANDART' },
  { path: '/dashboard/security', icon: Shield, label: 'Sozlamalar' },
  { path: '/dashboard/ai', icon: Bot, label: 'AI yordamchi', minPlan: 'PREMIUM' },
];

export default function DashboardLayout() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const plan = (company?.plan || 'START') as PlanKey;

  const isOperator = user?.role === 'OPERATOR';
  const isOmborchi = user?.role === 'OMBORCHI';
  const isInspektor = user?.role === 'INSPEKTOR';
  
  const customFeatureItems = [
    ...getActiveFeaturesByPlan(plan),
    ...getTestingFeaturesByPlan(plan),
  ].map(cf => ({
    path: `/dashboard/feature/${cf.id}`,
    icon: Sparkles,
    label: cf.status === 'testing' ? `🧪 ${cf.title}` : `✨ ${cf.title}`,
  }));

  const omborchiRoutes = ['/dashboard', '/dashboard/plomba'];
  const inspektorRoutes = ['/dashboard', '/dashboard/plomba'];

  const navItems = [
    ...allNavItems.filter(item => {
      if (!isRouteAllowed(plan, item.path)) return false;
      if (isOperator && item.path !== '/dashboard/meter') return false;
      if (isOmborchi && !omborchiRoutes.includes(item.path)) return false;
      if (isInspektor && !inspektorRoutes.includes(item.path)) return false;
      return true;
    }),
    ...((isOperator || isOmborchi || isInspektor) ? [] : customFeatureItems),
  ];

  useEffect(() => {
    const isCustomFeatureRoute = location.pathname.startsWith('/dashboard/feature/');
    if (!isCustomFeatureRoute && !isRouteAllowed(plan, location.pathname)) {
      navigate('/dashboard/meter');
      return;
    }
    if (isOperator && location.pathname !== '/dashboard/meter') {
      navigate('/dashboard/meter');
    }
    if (isOmborchi && !omborchiRoutes.includes(location.pathname)) {
      navigate('/dashboard');
    }
    if (isInspektor && !inspektorRoutes.includes(location.pathname)) {
      navigate('/dashboard');
    }
  }, [location.pathname, plan, navigate, isOperator, isOmborchi, isInspektor]);

  const handleLogout = () => { logout(); navigate('/'); };
  const isActive = (path: string) => location.pathname === path;
  const currentStation = getCurrentStation();
  const stationName = company?.stations?.[currentStation] || company?.stations?.[0] || company?.name || '';

  const handleStationChange = (idx: number) => {
    setCurrentStation(idx);
    window.location.reload();
  };

  const getPlanColor = () => {
    switch (plan) {
      case 'PREMIUM': return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
      case 'STANDART': return 'bg-gradient-to-r from-primary to-blue-400 text-primary-foreground';
      default: return 'bg-secondary text-foreground';
    }
  };

  return (
    <div className="min-h-screen flex relative">
      <AnimatedBackground />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 glass-sidebar shrink-0 relative z-10">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-white/20">
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
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-foreground hover:bg-white/40 hover:translate-x-0.5"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {'minPlan' in item && item.minPlan === 'PREMIUM' && <Crown className="h-3 w-3 ml-auto text-yellow-500" />}
            </button>
          ))}
        </nav>
        
        {plan !== 'PREMIUM' && (
          <div className="mx-3 mb-3 p-3 glass-card rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">
              {plan === 'START' ? 'Ishchilar va Plomba' : 'AI va Referallar'} uchun
            </p>
            <Button size="sm" className="w-full text-xs btn-glow" onClick={() => navigate('/dashboard')}>
              <Crown className="h-3 w-3 mr-1" />
              {plan === 'START' ? 'PRO ga' : 'PREMIUM ga'} yangilash
            </Button>
          </div>
        )}

        <div className="p-3 border-t border-white/20">
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
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 glass-sidebar transform transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/20">
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
                isActive(item.path) ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-white/40"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" /> {item.label}
              {'minPlan' in item && item.minPlan === 'PREMIUM' && <Crown className="h-3 w-3 ml-auto text-yellow-500" />}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/20">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 glass-header shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-foreground hover:text-primary">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-foreground truncate">{stationName}</h2>
            {company && company.stations.length > 1 && (
              <select
                value={currentStation}
                onChange={e => handleStationChange(Number(e.target.value))}
                className="text-xs glass-card rounded-md px-2 py-1 text-foreground border-none"
              >
                {company.stations.map((s, i) => (
                  <option key={i} value={i}>{s}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ReminderNotifications />
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {user?.role === 'BOSS' ? '👑 Boss' : user?.role === 'INSPEKTOR' ? '🔍 Inspektor' : user?.role === 'OMBORCHI' ? '📦 Omborchi' : '🔧 Operator'}
            </span>
            <span className={cn("text-xs px-2 py-1 rounded-md font-medium", getPlanColor())}>
              {plan === 'PREMIUM' && <Crown className="h-3 w-3 inline mr-1" />}
              {plan}
            </span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <SubscriptionGuard>
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </SubscriptionGuard>
        </main>
      </div>
    </div>
  );
}
