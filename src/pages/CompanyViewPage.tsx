import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanyByKey } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, PLANS } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Building2, Users, Calendar, Shield, User, CreditCard
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function CompanyViewPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (!key) return;
    const load = async () => {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('company_key', key)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setPayments(data);
    };
    load();
  }, [key]);

  if (!isSuperAdmin) {
    navigate('/login');
    return null;
  }

  const company = key ? getCompanyByKey(key) : undefined;
  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">Korxona topilmadi</p>
          <Button onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Orqaga
          </Button>
        </div>
      </div>
    );
  }

  const plan = PLANS[company.plan];
  const statusLabel = company.subscription.status === 'trial' ? 'Sinov' :
    company.subscription.status === 'active' ? 'Faol' :
    company.subscription.status === 'suspended' ? 'Bloklangan' : 'Tugagan';

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-card border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {company.name}
          </h1>
        </div>
        <span className="bg-secondary text-secondary-foreground text-xs px-3 py-1.5 rounded-lg font-semibold">
          {plan?.name || company.plan}
        </span>
      </div>

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Basic info */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard icon={Shield} label="Holat" value={statusLabel} />
          <InfoCard icon={Calendar} label="Ro'yxatdan o'tgan" value={formatDate(company.created_at)} />
          <InfoCard icon={Calendar} label="Obuna tugashi" value={company.subscription.active_until ? formatDate(company.subscription.active_until) : company.subscription.trial_end_date ? formatDate(company.subscription.trial_end_date) : '-'} />
          <InfoCard icon={Users} label="Ishchilar soni" value={String(company.users.length)} />
        </div>

        {/* Workers */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Ishchilar ({company.users.length})
          </h2>
          <div className="space-y-2">
            {company.users.map(u => (
              <div key={u.login} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{u.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                  u.role === 'BOSS' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                }`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payments */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> To'lovlar tarixi
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">To'lovlar yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Sana', 'Summa', 'Holat', 'Tasdiqlangan muddati'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-muted-foreground font-semibold text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 px-3 text-xs">{formatDate(p.payment_date || p.created_at)}</td>
                      <td className="py-2 px-3 font-semibold">{Number(p.amount).toLocaleString()} so'm</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                          p.status === 'approved' ? 'bg-success/10 text-success' :
                          p.status === 'pending' ? 'bg-warning/10 text-warning' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {p.status === 'approved' ? 'Tasdiqlangan' : p.status === 'pending' ? 'Kutilmoqda' : 'Rad etilgan'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{p.approved_until ? formatDate(p.approved_until) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
