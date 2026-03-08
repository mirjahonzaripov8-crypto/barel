import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanies } from '@/lib/store';
import { formatDate, PLANS } from '@/lib/helpers';
import { supabase } from '@/integrations/supabase/client';
import { Building2, LogOut, Eye, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect } from 'react';

export default function LookerPage() {
  const { logout, setLookerCompany } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const companies = getCompanies();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      if (data) setPayments(data);
    };
    load();
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const getLastPayment = (key: string) => {
    const p = payments.find(p => p.company_key === key);
    return p ? formatDate(p.payment_date || p.created_at) : '-';
  };

  const selectCompany = (key: string) => {
    setLookerCompany(key);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Korxonalar ro'yxati</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/login'); }}>
          <LogOut className="h-4 w-4 mr-1" /> Chiqish
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Korxona qidirish..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/80">
              <tr>
                {['Korxona', "Ro'yxatdan o'tgan", 'Tarif', 'Ishchilar', "Oxirgi to'lov", 'Obuna tugashi', ''].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-muted-foreground font-semibold text-xs uppercase tracking-wider border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.key} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground">{c.name}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="py-3 px-4">
                    <span className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-md font-medium">
                      {PLANS[c.plan]?.name || c.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs">{c.users.length} ta</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{getLastPayment(c.key)}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {c.subscription.active_until ? formatDate(c.subscription.active_until) : c.subscription.trial_end_date ? formatDate(c.subscription.trial_end_date) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <Button size="sm" className="h-7 text-xs" onClick={() => selectCompany(c.key)}>
                      <Eye className="h-3 w-3 mr-1" /> Kirish
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Korxonalar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
