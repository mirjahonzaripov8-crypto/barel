import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { updateCompany } from '@/lib/store';
import { toast } from 'sonner';

const COLORS = ['#2563EB', '#16a34a', '#d97706', '#dc2626', '#8b5cf6'];

export default function FinancePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [prices, setPrices] = useState<Record<string, number>>(company?.conf.prices || {});
  const [fixCost, setFixCost] = useState(company?.conf.fix || 0);

  if (!company) return null;

  const filtered = company.data.filter(d => isInRange(d.date, from, to));

  const revenue = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  const expenses = filtered.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0) + fixCost * filtered.length / 30;
  const costTotal = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * (prices[f.type] || 0), 0), 0);
  const net = revenue - expenses - costTotal;

  const pieData = company.fuelTypes.map((ft, i) => ({
    name: ft.name,
    value: filtered.reduce((s, d) => {
      const f = d.fuels.find(x => x.type === ft.name);
      return s + (f ? f.sold * f.price - f.sold * (prices[ft.name] || 0) : 0);
    }, 0),
  })).filter(d => d.value > 0);

  const saveConf = () => {
    updateCompany(company.key, c => ({ ...c, conf: { prices, fix: fixCost } }));
    refreshCompany();
    toast.success("Sozlamalar saqlandi!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">MOLIYA VA TAHLIL</h1>

      {/* Date range & stats */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Tushum</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(revenue)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Xarajatlar</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(expenses + costTotal)}</p>
          </div>
          <div className={`rounded-lg p-4 ${net >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs text-muted-foreground">SOF FOYDA</span></div>
            <p className={`text-xl font-bold ${net >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(net)}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Mahsulotlar foydasi</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Sozlamalar</h3>
          <div className="space-y-3">
            {company.fuelTypes.map(ft => (
              <div key={ft.name} className="flex items-center gap-3">
                <Label className="text-sm w-20 shrink-0">{ft.name}</Label>
                <Input type="number" value={prices[ft.name] || ''} onChange={e => setPrices(p => ({ ...p, [ft.name]: Number(e.target.value) }))} placeholder="Tannarx" className="flex-1" />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Label className="text-sm w-20 shrink-0">Oylik xar.</Label>
              <Input type="number" value={fixCost || ''} onChange={e => setFixCost(Number(e.target.value))} placeholder="Doimiy oylik xarajat" className="flex-1" />
            </div>
            <Button onClick={saveConf} className="w-full mt-2">SAQLASH</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
