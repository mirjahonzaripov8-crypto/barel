import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, FileDown } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { updateCompany } from '@/lib/store';
import { toast } from 'sonner';
import { createPdf, addTable, addSummaryRow, downloadPdf, formatNum } from '@/lib/pdf';

const COLORS = ['#2563EB', '#16a34a', '#d97706', '#dc2626', '#8b5cf6'];

export default function FinancePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [fixCost, setFixCost] = useState(company?.conf.fix || 0);

  if (!company) return null;

  const filtered = company.data.filter(d => isInRange(d.date, from, to));

  const revenue = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  const expenses = filtered.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0) + fixCost * filtered.length / 30;
  // Tannarx now comes from meter prixod data
  const costTotal = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0), 0);
  const net = revenue - expenses - costTotal;

  const pieData = company.fuelTypes.map((ft) => ({
    name: ft.name,
    value: filtered.reduce((s, d) => {
      const f = d.fuels.find(x => x.type === ft.name);
      return s + (f ? f.sold * f.price - (f.prixod || 0) * (f.tannarx || 0) : 0);
    }, 0),
  })).filter(d => d.value > 0);

  const saveConf = () => {
    updateCompany(company.key, c => ({ ...c, conf: { ...c.conf, fix: fixCost } }));
    refreshCompany();
    toast.success("Sozlamalar saqlandi!");
  };

  const exportPdf = () => {
    const doc = createPdf('MOLIYA VA TAHLIL', from, to);
    let y = 36;

    // Summary
    doc.setFontSize(12);
    doc.text('Umumiy ko\'rsatkichlar', 14, y);
    y += 6;
    y = addTable(doc, [['Ko\'rsatkich', 'Summa']], [
      ['Tushum', formatNum(revenue) + ' so\'m'],
      ['Xarajatlar', formatNum(Math.round(expenses)) + ' so\'m'],
      ['Tannarx (prixod)', formatNum(costTotal) + ' so\'m'],
      ['SOF FOYDA', formatNum(net) + ' so\'m'],
    ], y);

    y += 8;
    doc.setFontSize(12);
    doc.text('Kunlik tafsilot', 14, y);
    y += 6;

    const body = filtered.map(d => {
      const rev = d.fuels.reduce((a, f) => a + f.sold * f.price, 0);
      const exp = d.expenses.reduce((a, e) => a + e.amount, 0);
      const cost = d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0);
      return [d.date, formatNum(rev), formatNum(exp), formatNum(cost), formatNum(rev - exp - cost)];
    });

    y = addTable(doc, [['Sana', 'Tushum', 'Xarajat', 'Tannarx', 'Foyda']], body, y);
    y = addSummaryRow(doc, 'JAMI SOF FOYDA:', formatNum(net) + ' so\'m', y);

    downloadPdf(doc, `moliya_${from}_${to}.pdf`);
    toast.success('PDF yuklandi!');
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
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Tushum</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(revenue)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Xarajatlar</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(expenses)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-warning" /><span className="text-xs text-muted-foreground">Tannarx (prixod)</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(costTotal)}</p>
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

        {/* Settings — only fixed monthly cost remains */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Sozlamalar</h3>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Doimiy oylik xarajat</Label>
              <Input type="number" value={fixCost || ''} onChange={e => setFixCost(Number(e.target.value))} placeholder="Masalan: 2 500 000" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Ijara, kommunal va boshqa doimiy xarajatlar</p>
            </div>
            <Button onClick={saveConf} className="w-full">SAQLASH</Button>
          </div>
          <div className="mt-6 p-3 bg-secondary/50 rounded-lg">
            <p className="text-xs text-muted-foreground">💡 Tannarx endi <b>Hisoblagich</b> sahifasida har bir mahsulot uchun prixod (kirish) bo'limida kiritiladi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
