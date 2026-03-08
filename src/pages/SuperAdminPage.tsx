import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanies, saveCompanies, getPayments, savePayments } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, CreditCard, MessageSquare, LogOut, Eye, Plus, Ban, CheckCircle, Zap, Send } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'home' | 'payments' | 'messages';

export default function SuperAdminPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('home');
  const [broadcastMsg, setBroadcastMsg] = useState('');

  const companies = getCompanies();
  const payments = getPayments();

  const handleLogout = () => { logout(); navigate('/'); };

  const extendOneMonth = (key: string) => {
    const cs = getCompanies();
    const idx = cs.findIndex(c => c.key === key);
    if (idx < 0) return;
    const c = cs[idx];
    const base = c.subscription.active_until ? new Date(c.subscription.active_until) : new Date();
    base.setMonth(base.getMonth() + 1);
    cs[idx] = { ...c, subscription: { ...c.subscription, status: 'active', active_until: base.toISOString() } };
    saveCompanies(cs);
    toast.success(`${c.name} — 1 oy uzaytirildi!`);
  };

  const toggleSuspend = (key: string) => {
    const cs = getCompanies();
    const idx = cs.findIndex(c => c.key === key);
    if (idx < 0) return;
    const c = cs[idx];
    const newStatus = c.subscription.status === 'suspended' ? 'active' : 'suspended';
    cs[idx] = { ...c, subscription: { ...c.subscription, status: newStatus } };
    saveCompanies(cs);
    toast.success(`${c.name} — ${newStatus === 'suspended' ? 'Bloklandi' : 'Faollashtirildi'}`);
  };

  const approvePayment = (paymentId: string) => {
    const ps = getPayments();
    const idx = ps.findIndex(p => p.id === paymentId);
    if (idx < 0) return;
    ps[idx].status = 'approved';
    const until = new Date();
    until.setMonth(until.getMonth() + 1);
    ps[idx].approved_until = until.toISOString();
    savePayments(ps);

    // Update company subscription
    const cs = getCompanies();
    const ci = cs.findIndex(c => c.key === ps[idx].companyKey);
    if (ci >= 0) {
      cs[ci].subscription = { ...cs[ci].subscription, status: 'active', active_until: until.toISOString() };
      saveCompanies(cs);
    }
    toast.success("To'lov tasdiqlandi!");
  };

  const sideItems = [
    { id: 'home' as Tab, icon: Building2, label: 'Korxonalar' },
    { id: 'payments' as Tab, icon: CreditCard, label: "To'lovlar" },
    { id: 'messages' as Tab, icon: MessageSquare, label: 'Xabarlar' },
  ];

  const pendingPayments = payments.filter(p => p.status === 'pending');

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-card border-r border-border flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-foreground text-sm">SUPER ADMIN</span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {sideItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === item.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}>
              <item.icon className="h-4 w-4" /> {item.label}
              {item.id === 'payments' && pendingPayments.length > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">{pendingPayments.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {tab === 'home' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-foreground mb-6">Korxonalar</h1>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Jami korxonalar</p>
                <p className="text-2xl font-bold text-foreground">{companies.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Faol obunalar</p>
                <p className="text-2xl font-bold text-success">{companies.filter(c => c.subscription.status === 'active').length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">Kutilayotgan to'lovlar</p>
                <p className="text-2xl font-bold text-warning">{pendingPayments.length}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    {['Korxona', 'Yaratilgan', 'Tarif', 'Holat', 'Amal'].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-2 font-medium">{c.name}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{formatDate(c.created_at)}</td>
                      <td className="py-2 px-2"><span className="bg-secondary text-foreground text-xs px-2 py-0.5 rounded-md">{c.plan}</span></td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-md ${c.subscription.status === 'active' ? 'bg-success/10 text-success' : c.subscription.status === 'trial' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                          {c.subscription.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendOneMonth(c.key)}><Plus className="h-3 w-3 mr-1" /> +1 oy</Button>
                        <Button variant={c.subscription.status === 'suspended' ? 'default' : 'destructive'} size="sm" className="h-7 text-xs" onClick={() => toggleSuspend(c.key)}>
                          {c.subscription.status === 'suspended' ? <><CheckCircle className="h-3 w-3 mr-1" /> Faol</> : <><Ban className="h-3 w-3 mr-1" /> Blok</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-foreground mb-6">To'lovlar</h1>
            <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    {['Korxona', 'Summa', 'Sana', 'Holat', 'Amal'].map(h => (
                      <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">To'lovlar yo'q</td></tr>
                  ) : payments.map(p => {
                    const comp = companies.find(c => c.key === p.companyKey);
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-2 px-2">{comp?.name || p.companyKey}</td>
                        <td className="py-2 px-2 font-medium">{formatCurrency(p.amount)}</td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{formatDate(p.payment_date)}</td>
                        <td className="py-2 px-2">
                          <span className={`text-xs px-2 py-0.5 rounded-md ${p.status === 'approved' ? 'bg-success/10 text-success' : p.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>{p.status}</span>
                        </td>
                        <td className="py-2 px-2">
                          {p.status === 'pending' && (
                            <Button size="sm" className="h-7 text-xs" onClick={() => approvePayment(p.id)}>
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
        )}

        {tab === 'messages' && (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-foreground mb-6">Xabarlar</h1>
            <div className="bg-card border border-border rounded-lg p-4 md:p-6 max-w-lg">
              <h3 className="font-semibold text-foreground mb-3">Barchaga xabar yuborish</h3>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Xabar matnini kiriting..." className="w-full h-28 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none mb-3" />
              <Button onClick={() => { if (broadcastMsg.trim()) { toast.success("Xabar yuborildi!"); setBroadcastMsg(''); } }} className="w-full">
                <Send className="h-4 w-4 mr-1" /> Barchaga yuborish
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
