import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanies, saveCompanies, getFeatureRequests, saveFeatureRequests, getAdminCard, saveAdminCard, type Company, type FeatureRequest } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate, formatNumber, PLANS, type PlanKey } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Building2, CreditCard, MessageSquare, LogOut, Eye, Plus, Ban, CheckCircle,
  Send, Home, ShieldCheck, Calendar, Users, Fuel, Lock, Unlock, X, FileText, Sparkles, Wallet, ScanFace
} from 'lucide-react';
import { toast } from 'sonner';
import {
  isWebAuthnSupported, registerBiometric, verifyBiometric,
  hasBiometricRegistered, isInIframe
} from '@/lib/biometric';

type Tab = 'home' | 'companies' | 'payments' | 'messages' | 'features' | 'card' | 'faceid';

function getStatusLabel(status: string) {
  switch (status) {
    case 'trial': return 'Sinov';
    case 'active': return 'Faol';
    case 'expired': return 'Tugagan';
    case 'suspended': return 'Bloklangan';
    default: return status;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'trial': return 'bg-warning/10 text-warning';
    case 'active': return 'bg-success/10 text-success';
    case 'expired': return 'bg-destructive/10 text-destructive';
    case 'suspended': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function SuperAdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('home');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [, setRefresh] = useState(0);

  // Security modal
  const [securityOpen, setSecurityOpen] = useState(false);
  const [securityPw, setSecurityPw] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Receipt modal
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<string | null>(null);
  const [receiptInfo, setReceiptInfo] = useState('');

  // Duration modal for payment approval
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationMonths, setDurationMonths] = useState(1);
  const [customDate, setCustomDate] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  // Feature request modals
  const [featureResponseOpen, setFeatureResponseOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [featureAdminResponse, setFeatureAdminResponse] = useState('');
  const [featurePrice, setFeaturePrice] = useState('');
  const [featurePromptOpen, setFeaturePromptOpen] = useState(false);
  const [featurePrompt, setFeaturePrompt] = useState('');

  // Card info
  const [cardNumber, setCardNumber] = useState(() => getAdminCard().cardNumber);
  const [cardHolder, setCardHolder] = useState(() => getAdminCard().cardHolder);

  const companies = getCompanies();
  const [payments, setPayments] = useState<any[]>([]);
  const featureRequests = getFeatureRequests();
  const pendingPayments = payments.filter((p: any) => p.status === 'pending');
  const pendingFeatures = featureRequests.filter(f => f.status === 'pending' || f.status === 'paid');
  const activeCount = companies.filter(c => c.subscription.status === 'active' || c.subscription.status === 'trial').length;

  const forceRefresh = () => setRefresh(r => r + 1);

  // Load payments from DB
  useEffect(() => {
    const loadPayments = async () => {
      const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (data) setPayments(data);
    };
    loadPayments();
    const interval = setInterval(loadPayments, 5000);
    return () => clearInterval(interval);
  }, []);

  const requireSecurity = useCallback((action: () => void) => {
    setPendingAction(() => action);
    setSecurityPw('');
    setSecurityError('');
    setSecurityOpen(true);
  }, []);

  const confirmSecurity = () => {
    if (securityPw === '201116ZM') {
      setSecurityOpen(false);
      pendingAction?.();
      setPendingAction(null);
    } else {
      setSecurityError('Parol xato!');
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const extendOneMonth = (key: string) => {
    requireSecurity(() => {
      const cs = getCompanies();
      const idx = cs.findIndex(c => c.key === key);
      if (idx < 0) return;
      const c = cs[idx];
      const base = c.subscription.active_until ? new Date(c.subscription.active_until) : new Date();
      base.setMonth(base.getMonth() + 1);
      cs[idx] = { ...c, subscription: { ...c.subscription, status: 'active', active_until: base.toISOString() } };
      saveCompanies(cs);
      toast.success(`${c.name} — 1 oy uzaytirildi!`);
      forceRefresh();
    });
  };

  const toggleSuspend = (key: string) => {
    requireSecurity(() => {
      const cs = getCompanies();
      const idx = cs.findIndex(c => c.key === key);
      if (idx < 0) return;
      const c = cs[idx];
      const newStatus = c.subscription.status === 'suspended' ? 'active' : 'suspended';
      cs[idx] = { ...c, subscription: { ...c.subscription, status: newStatus } };
      saveCompanies(cs);
      toast.success(`${c.name} — ${newStatus === 'suspended' ? 'Bloklandi' : 'Faollashtirildi'}`);
      forceRefresh();
    });
  };

  const openApprovalDuration = (paymentId: string) => {
    setPendingPaymentId(paymentId);
    setDurationMonths(1);
    setCustomDate('');
    setUseCustomDate(false);
    setDurationOpen(true);
  };

  const confirmApproval = () => {
    if (!pendingPaymentId) return;
    const pid = pendingPaymentId;
    setDurationOpen(false);

    requireSecurity(async () => {
      let until: Date;
      if (useCustomDate && customDate) {
        until = new Date(customDate);
      } else {
        until = new Date();
        until.setMonth(until.getMonth() + durationMonths);
      }

      await supabase.from('payments').update({ status: 'approved', approved_until: until.toISOString() }).eq('id', pid);

      // Also update local company subscription
      const payment = payments.find((p: any) => p.id === pid);
      if (payment) {
        const cs = getCompanies();
        const ci = cs.findIndex(c => c.key === payment.company_key);
        if (ci >= 0) {
          cs[ci].subscription = { ...cs[ci].subscription, status: 'active', active_until: until.toISOString() };
          saveCompanies(cs);
        }
      }
      toast.success("To'lov tasdiqlandi!");
      forceRefresh();
      // Reload payments
      const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (data) setPayments(data);
    });
  };

  const viewReceipt = (payment: any) => {
    if (payment.receipt_base64) {
      setReceiptData(payment.receipt_base64);
      setReceiptInfo(`Holati: ${payment.status} · Sana: ${formatDate(payment.payment_date)} · Summa: ${formatCurrency(payment.amount)}`);
      setReceiptOpen(true);
    } else {
      toast.error("Chek yuklanmagan");
    }
  };

  const sendBroadcast = () => {
    if (!broadcastMsg.trim()) {
      toast.error("Xabar matnini kiriting.");
      return;
    }
    requireSecurity(() => {
      const notifs = JSON.parse(localStorage.getItem('notifications') || '[]');
      notifs.push({
        id: Date.now(),
        sender: 'admin',
        receiver: 'all',
        message_text: broadcastMsg.trim(),
        created_at: new Date().toISOString(),
        read: false,
      });
      localStorage.setItem('notifications', JSON.stringify(notifs));
      toast.success("Xabar barchaga yuborildi.");
      setBroadcastMsg('');
    });
  };

  const viewCompany = (key: string) => {
    navigate(`/admin/company/${key}`);
  };

  // Feature request handlers
  const openFeatureResponse = (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setFeatureAdminResponse(feature.adminResponse || '');
    setFeaturePrice(feature.price ? String(feature.price) : '');
    setFeatureResponseOpen(true);
  };

  const submitFeatureResponse = () => {
    if (!selectedFeature || !featureAdminResponse.trim() || !featurePrice.trim()) {
      toast.error("Javob va narxni kiriting!");
      return;
    }
    requireSecurity(() => {
      const reqs = getFeatureRequests();
      const idx = reqs.findIndex(r => r.id === selectedFeature!.id);
      if (idx >= 0) {
        reqs[idx] = {
          ...reqs[idx],
          adminResponse: featureAdminResponse.trim(),
          price: parseInt(featurePrice),
          status: 'priced',
          updated_at: new Date().toISOString(),
        };
        saveFeatureRequests(reqs);
      }
      toast.success("Javob va narx yuborildi!");
      setFeatureResponseOpen(false);
      forceRefresh();
    });
  };

  const openFeaturePrompt = (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setFeaturePrompt('');
    setFeaturePromptOpen(true);
  };

  const submitFeatureComplete = () => {
    if (!selectedFeature || !featurePrompt.trim()) {
      toast.error("Prompt kiriting!");
      return;
    }
    requireSecurity(() => {
      const reqs = getFeatureRequests();
      const idx = reqs.findIndex(r => r.id === selectedFeature!.id);
      if (idx >= 0) {
        reqs[idx] = {
          ...reqs[idx],
          adminPrompt: featurePrompt.trim(),
          status: 'done',
          updated_at: new Date().toISOString(),
        };
        saveFeatureRequests(reqs);
      }
      toast.success("Funksiya bajarildi deb belgilandi!");
      setFeaturePromptOpen(false);
      forceRefresh();
    });
  };

  const rejectFeature = (featureId: string) => {
    requireSecurity(() => {
      const reqs = getFeatureRequests();
      const idx = reqs.findIndex(r => r.id === featureId);
      if (idx >= 0) {
        reqs[idx] = { ...reqs[idx], status: 'rejected', updated_at: new Date().toISOString() };
        saveFeatureRequests(reqs);
      }
      toast.success("So'rov rad etildi.");
      forceRefresh();
    });
  };

  const sideItems = [
    { id: 'home' as Tab, icon: Home, label: 'Bosh sahifa' },
    { id: 'companies' as Tab, icon: Building2, label: 'Korxonalar' },
    { id: 'payments' as Tab, icon: CreditCard, label: "To'lovlar", badge: pendingPayments.length },
    { id: 'features' as Tab, icon: Sparkles, label: "Funksiya so'rovlar", badge: pendingFeatures.length },
    { id: 'card' as Tab, icon: Wallet, label: "Karta ma'lumotlari" },
    { id: 'messages' as Tab, icon: MessageSquare, label: 'Xabarlar' },
    { id: 'faceid' as Tab, icon: ScanFace, label: 'Face ID' },
  ];

  const getFeatureStatusBadge = (status: FeatureRequest['status']) => {
    switch (status) {
      case 'pending': return <span className="text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning font-medium">Yangi</span>;
      case 'priced': return <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">Narx belgilandi</span>;
      case 'paid': return <span className="text-xs px-2 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">To'langan</span>;
      case 'done': return <span className="text-xs px-2 py-0.5 rounded-md bg-success/10 text-success font-medium">Bajarildi</span>;
      case 'rejected': return <span className="text-xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium">Rad etildi</span>;
    }
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <Fuel className="h-6 w-6 text-primary" />
          <span className="font-extrabold text-primary text-lg tracking-tight">BAREL Admin</span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {sideItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === item.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-foreground hover:bg-accent'
              }`}>
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{item.badge}</span>
              ) : null}
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
      <main className="flex-1 p-8 overflow-y-auto">
        {/* HOME */}
        {tab === 'home' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">Bosh sahifa</h1>
            <div className="grid sm:grid-cols-4 gap-5 mb-8">
              <StatCard icon={Building2} label="Jami korxonalar" value={companies.length} />
              <StatCard icon={CheckCircle} label="Faol obunalar" value={activeCount} color="text-success" />
              <StatCard icon={CreditCard} label="Kutilayotgan to'lovlar" value={pendingPayments.length} color="text-warning" />
              <StatCard icon={Sparkles} label="Funksiya so'rovlar" value={pendingFeatures.length} color="text-primary" />
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Oxirgi korxonalar
              </h2>
              <div className="space-y-2">
                {companies.slice(-5).reverse().map(c => (
                  <div key={c.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                    <div>
                      <span className="font-medium text-sm text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground ml-3">{PLANS[c.plan]?.name || c.plan}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getStatusColor(c.subscription.status)}`}>
                      {getStatusLabel(c.subscription.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COMPANIES */}
        {tab === 'companies' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">Korxonalar</h1>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      {['Korxona', "Ro'yxat", 'Tarif', 'Holat', 'Obuna tugashi', 'Ishchilar', 'Chek', 'Amallar'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(c => {
                      const hasPendingReceipt = payments.some(p => p.companyKey === c.key && p.status === 'pending' && p.receipt_base64);
                      return (
                        <tr key={c.key} className="border-b border-border/50 hover:bg-accent/30 transition-colors group">
                          <td className="py-3 px-4">
                            <button onClick={() => viewCompany(c.key)} className="font-semibold text-primary hover:underline text-left">
                              {c.name}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(c.created_at)}</td>
                          <td className="py-3 px-4">
                            <span className="bg-secondary text-secondary-foreground text-xs px-2.5 py-1 rounded-md font-medium">
                              {PLANS[c.plan]?.name || c.plan}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${getStatusColor(c.subscription.status)}`}>
                              {getStatusLabel(c.subscription.status)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {c.subscription.active_until ? formatDate(c.subscription.active_until) : c.subscription.trial_end_date ? formatDate(c.subscription.trial_end_date) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" /> {c.users.length}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {hasPendingReceipt ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                const p = payments.find(p => p.companyKey === c.key && p.status === 'pending' && p.receipt_base64);
                                if (p) viewReceipt(p);
                              }}>
                                <Eye className="h-3 w-3 mr-1" /> Ko'rish
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">-</span>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => viewCompany(c.key)}>
                                <Eye className="h-3 w-3 mr-1" /> Ko'rish
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendOneMonth(c.key)}>
                                <Plus className="h-3 w-3 mr-1" /> +1 oy
                              </Button>
                              <Button
                                variant={c.subscription.status === 'suspended' ? 'default' : 'destructive'}
                                size="sm" className="h-7 text-xs"
                                onClick={() => toggleSuspend(c.key)}
                              >
                                {c.subscription.status === 'suspended'
                                  ? <><Unlock className="h-3 w-3 mr-1" /> Faol</>
                                  : <><Lock className="h-3 w-3 mr-1" /> Blok</>
                                }
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {companies.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Korxonalar yo'q</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">To'lovlar</h1>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                    <tr>
                      {['Korxona', 'Summa', 'Sana', 'Holat', 'Chek', 'Amal'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">To'lovlar yo'q</td></tr>
                    ) : payments.map((p: any) => {
                      const comp = companies.find(c => c.key === p.company_key);
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{p.company_name || comp?.name || p.company_key}</td>
                          <td className="py-3 px-4 font-semibold">{formatCurrency(p.amount)}</td>
                          <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(p.payment_date || p.created_at)}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                              p.status === 'approved' ? 'bg-success/10 text-success' :
                              p.status === 'pending' ? 'bg-warning/10 text-warning' :
                              'bg-destructive/10 text-destructive'
                            }`}>{p.status === 'approved' ? 'Tasdiqlangan' : p.status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan'}</span>
                          </td>
                          <td className="py-3 px-4">
                            {p.receipt_base64 ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => viewReceipt(p)}>
                                <FileText className="h-3 w-3 mr-1" /> Chek
                              </Button>
                            ) : <span className="text-xs text-muted-foreground">-</span>}
                          </td>
                          <td className="py-3 px-4">
                            {p.status === 'pending' && (
                              <Button size="sm" className="h-7 text-xs" onClick={() => openApprovalDuration(p.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Tasdiqlash
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FEATURE REQUESTS */}
        {tab === 'features' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">Funksiya so'rovlari</h1>
            {featureRequests.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
                Hali so'rovlar yo'q
              </div>
            ) : (
              <div className="space-y-4">
                {[...featureRequests].reverse().map(fr => (
                  <div key={fr.id} className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground text-sm">{fr.companyName}</span>
                          {getFeatureStatusBadge(fr.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">{new Date(fr.created_at).toLocaleDateString('uz-UZ')}</p>
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-3 mb-3">
                      <p className="text-sm text-foreground">{fr.description}</p>
                    </div>

                    {fr.adminResponse && (
                      <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Sizning javobingiz:</p>
                        <p className="text-sm text-foreground">{fr.adminResponse}</p>
                        {fr.price && <p className="text-sm font-bold text-primary mt-1">Narx: {formatCurrency(fr.price)}</p>}
                      </div>
                    )}

                    {fr.adminPrompt && (
                      <div className="bg-success/5 border border-success/20 rounded-lg p-3 mb-3">
                        <p className="text-xs text-success font-medium mb-1">Qo'shilgan funksiya promti:</p>
                        <p className="text-sm text-foreground">{fr.adminPrompt}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      {fr.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => openFeatureResponse(fr)}>
                            <Send className="h-3 w-3 mr-1" /> Javob va narx
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => rejectFeature(fr.id)}>
                            <X className="h-3 w-3 mr-1" /> Rad etish
                          </Button>
                        </>
                      )}
                      {fr.status === 'paid' && (
                        <Button size="sm" onClick={() => openFeaturePrompt(fr)}>
                          <Sparkles className="h-3 w-3 mr-1" /> Funksiyani qo'shish
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CARD SETTINGS */}
        {tab === 'card' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">Karta ma'lumotlari</h1>
            <div className="bg-card border border-border rounded-xl p-6 max-w-lg space-y-4">
              <p className="text-sm text-muted-foreground">
                Bu karta raqam va ism-familya barcha foydalanuvchilarga obuna to'lovi uchun ko'rsatiladi.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Karta raqami</label>
                <Input
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  placeholder="8600 1234 5678 9012"
                  maxLength={19}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Karta egasi (Ism Familya)</label>
                <Input
                  value={cardHolder}
                  onChange={e => setCardHolder(e.target.value)}
                  placeholder="Zaripov Mansur"
                />
              </div>
              <Button onClick={() => {
                saveAdminCard({ cardNumber: cardNumber.trim(), cardHolder: cardHolder.trim() });
                toast.success("Karta ma'lumotlari saqlandi!");
              }} className="w-full">
                Saqlash
              </Button>

              {cardNumber && (
                <div className="mt-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
                  <p className="text-xs text-muted-foreground mb-2">Hozirgi karta:</p>
                  <p className="text-lg font-bold text-foreground tracking-widest">{cardNumber}</p>
                  <p className="text-sm text-muted-foreground mt-1">{cardHolder}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {tab === 'messages' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-extrabold text-foreground mb-6">Ommaviy xabar yuborish</h1>
            <div className="bg-card border border-border rounded-xl p-6 max-w-lg">
              <p className="text-sm text-muted-foreground mb-4">Barcha foydalanuvchilarga xabar yuboriladi.</p>
              <Textarea
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Barcha foydalanuvchilarga yuboriladigan xabar..."
                rows={4}
                className="mb-4"
              />
              <Button onClick={sendBroadcast} className="w-full">
                <Send className="h-4 w-4 mr-2" /> Barchaga yuborish
              </Button>
            </div>
          </div>
        )}

        {/* FACE ID */}
        {tab === 'faceid' && (
          <FaceIdSection />
        )}
      </main>

      {/* Security Confirmation Dialog */}
      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Harakatni tasdiqlash
            </DialogTitle>
            <DialogDescription>
              Harakatni amalga oshirish uchun Superadmin parolini kiriting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Superadmin paroli"
              value={securityPw}
              onChange={e => { setSecurityPw(e.target.value); setSecurityError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirmSecurity()}
              autoFocus
            />
            {securityError && <p className="text-destructive text-sm font-medium">{securityError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSecurityOpen(false)}>Orqaga</Button>
            <Button onClick={confirmSecurity}>Tasdiqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt View Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chek ko'rish</DialogTitle>
          </DialogHeader>
          {receiptData ? (
            <div className="space-y-3">
              {receiptData.startsWith('data:image') ? (
                <img src={receiptData} alt="Chek" className="w-full rounded-lg border border-border" />
              ) : (
                <p className="text-sm text-muted-foreground">Chek formatini ko'rsatib bo'lmadi</p>
              )}
              <p className="text-xs text-muted-foreground">{receiptInfo}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Chek yuklanmagan</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Duration Selection Dialog */}
      <Dialog open={durationOpen} onOpenChange={setDurationOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Obuna muddatini tanlang</DialogTitle>
            <DialogDescription>To'lovni tasdiqlash uchun muddat belgilang.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { months: 1, label: '+1 Oy' },
                { months: 3, label: '+3 Oy' },
                { months: 6, label: '+6 Oy' },
                { months: 12, label: '+1 Yil' },
              ].map(opt => (
                <button
                  key={opt.months}
                  onClick={() => { setDurationMonths(opt.months); setUseCustomDate(false); }}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                    !useCustomDate && durationMonths === opt.months
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'border-border text-foreground hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">yoki maxsus sana:</span>
              <Input
                type="date"
                value={customDate}
                onChange={e => { setCustomDate(e.target.value); setUseCustomDate(true); }}
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDurationOpen(false)}>Bekor</Button>
            <Button onClick={confirmApproval}>Tasdiqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Response Dialog */}
      <Dialog open={featureResponseOpen} onOpenChange={setFeatureResponseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Funksiyani tushuntirish va narx belgilash</DialogTitle>
            <DialogDescription>
              Mijoz so'rovi: {selectedFeature?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Tushuntirish</label>
              <Textarea
                value={featureAdminResponse}
                onChange={e => setFeatureAdminResponse(e.target.value)}
                placeholder="Bu funksiya qanday ishlashini tushuntiring..."
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Narx (so'm)</label>
              <Input
                type="number"
                value={featurePrice}
                onChange={e => setFeaturePrice(e.target.value)}
                placeholder="Masalan: 500000"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFeatureResponseOpen(false)}>Bekor</Button>
            <Button onClick={submitFeatureResponse}>Yuborish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Prompt Dialog (after payment) */}
      <Dialog open={featurePromptOpen} onOpenChange={setFeaturePromptOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Funksiyani qo'shish
            </DialogTitle>
            <DialogDescription>
              So'rov: {selectedFeature?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Prompt / Funksiya tavsifi</label>
              <Textarea
                value={featurePrompt}
                onChange={e => setFeaturePrompt(e.target.value)}
                placeholder="Funksiyani qo'shish uchun batafsil prompt yozing..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFeaturePromptOpen(false)}>Bekor</Button>
            <Button onClick={submitFeatureComplete}>
              <CheckCircle className="h-4 w-4 mr-2" /> Bajarildi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-extrabold mt-1 ${color || 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function FaceIdSection() {
  const [loading, setLoading] = useState(false);
  const supported = isWebAuthnSupported();
  const superadminRegistered = hasBiometricRegistered('superadmin');
  const lookerRegistered = hasBiometricRegistered('looker');
  const [, setRefresh] = useState(0);

  const handleRegister = async (loginKey: string, label: string) => {
    setLoading(true);
    try {
      const ok = await registerBiometric(loginKey);
      if (ok) {
        toast.success(`${label} uchun Face ID muvaffaqiyatli sozlandi!`);
        setRefresh(r => r + 1);
      } else {
        toast.error("Face ID sozlab bo'lmadi.");
      }
    } catch {
      toast.error("Xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (loginKey: string, label: string) => {
    setLoading(true);
    try {
      const ok = await verifyBiometric(loginKey);
      if (ok) {
        toast.success(`${label} — yuz muvaffaqiyatli tasdiqlandi! ✅`);
      } else {
        toast.error(`${label} — yuz tanilmadi! ❌`);
      }
    } catch {
      toast.error("Tekshirish xatosi.");
    } finally {
      setLoading(false);
    }
  };

  const inIframe = isInIframe();

  if (!supported || inIframe) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-extrabold text-foreground mb-6">Face ID</h1>
        <div className="bg-card border border-border rounded-xl p-6">
          {inIframe ? (
            <>
              <p className="text-warning font-medium">⚠️ Face ID preview rejimida ishlamaydi!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Face ID faqat <b>publish qilingan</b> saytda ishlaydi. Ilovani publish qiling, so'ng to'liq sahifada Face ID ni sozlang.
              </p>
            </>
          ) : (
            <>
              <p className="text-destructive font-medium">Bu qurilma/brauzer Face ID / biometrikni qo'llab-quvvatlamaydi.</p>
              <p className="text-sm text-muted-foreground mt-2">HTTPS va zamonaviy brauzer (Safari, Chrome) kerak.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-extrabold text-foreground mb-6">Face ID boshqaruv</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Maxfiy loginlar uchun Face ID / biometrik himoyani sozlang. Ro'yxatdan o'tkazilgandan so'ng, kirish uchun yuzingiz talab qilinadi.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl">
        {/* SuperAdmin */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanFace className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Super Admin</h3>
              <p className="text-xs text-muted-foreground">ZARIPOVM login</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
              superadminRegistered ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}>
              {superadminRegistered ? '✅ Sozlangan' : '⚠️ Sozlanmagan'}
            </span>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => handleRegister('superadmin', 'Super Admin')}
              disabled={loading}
            >
              <ScanFace className="h-4 w-4 mr-2" />
              {superadminRegistered ? "Qayta sozlash" : "Face ID sozlash"}
            </Button>
            {superadminRegistered && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleTest('superadmin', 'Super Admin')}
                disabled={loading}
              >
                Test qilish
              </Button>
            )}
          </div>
        </div>

        {/* Looker */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanFace className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Kuzatuvchi</h3>
              <p className="text-xs text-muted-foreground">looker54789 login</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${
              lookerRegistered ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}>
              {lookerRegistered ? '✅ Sozlangan' : '⚠️ Sozlanmagan'}
            </span>
          </div>
          <div className="space-y-2">
            <Button
              className="w-full"
              onClick={() => handleRegister('looker', 'Kuzatuvchi')}
              disabled={loading}
            >
              <ScanFace className="h-4 w-4 mr-2" />
              {lookerRegistered ? "Qayta sozlash" : "Face ID sozlash"}
            </Button>
            {lookerRegistered && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleTest('looker', 'Kuzatuvchi')}
                disabled={loading}
              >
                Test qilish
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
