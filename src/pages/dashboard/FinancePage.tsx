import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, FileDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { updateCompany, getStationData, getCurrentStation, getBaseFuelName } from '@/lib/store';
import { toast } from 'sonner';
import { createPdf, addTable, addSummaryRow, downloadPdf, formatNum } from '@/lib/pdf';
import GlassCard from '@/components/GlassCard';
import AnimatedCounter from '@/components/AnimatedCounter';

const COLORS = ['#2563EB', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];

export default function FinancePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [fixCost, setFixCost] = useState(company?.conf.fix || 0);
  const [compareMode, setCompareMode] = useState(false);

  if (!company) return null;

  const stationIdx = getCurrentStation();
  const hasMultiStations = company.stations.length > 1;

  const getFilteredData = (sIdx: number) => getStationData(company, sIdx).filter(d => isInRange(d.date, from, to));
  const filtered = getFilteredData(stationIdx);

  const revenue = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  const expenses = filtered.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0) + fixCost * filtered.length / 30;
  const costTotal = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0), 0);
  const net = revenue - expenses - costTotal;

  const today = getTodayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const todayData = getStationData(company, stationIdx).find(d => d.date === today);
  const yesterdayData = getStationData(company, stationIdx).find(d => d.date === yesterday);
  
  const todaySales = todayData ? todayData.fuels.reduce((s, f) => s + f.sold, 0) : 0;
  const yesterdaySales = yesterdayData ? yesterdayData.fuels.reduce((s, f) => s + f.sold, 0) : 0;
  const salesDiff = todaySales - yesterdaySales;
  
  const todayRevenue = todayData ? todayData.fuels.reduce((s, f) => s + f.sold * f.price, 0) : 0;
  const yesterdayRevenue = yesterdayData ? yesterdayData.fuels.reduce((s, f) => s + f.sold * f.price, 0) : 0;
  const revenueDiff = todayRevenue - yesterdayRevenue;

  const fuelNames = new Set<string>();
  filtered.forEach(d => d.fuels.forEach(f => fuelNames.add(getBaseFuelName(f.type))));
  const pieData = [...fuelNames].map(name => ({
    name,
    value: filtered.reduce((s, d) => s + d.fuels.filter(f => getBaseFuelName(f.type) === name).reduce((a, f) => a + f.sold * f.price - (f.prixod || 0) * (f.tannarx || 0), 0), 0),
  })).filter(d => d.value > 0);

  const candleData = filtered.map((d, i) => {
    const dayRevenue = d.fuels.reduce((s, f) => s + f.sold * f.price, 0);
    const dayExp = d.expenses.reduce((s, e) => s + e.amount, 0);
    const dayCost = d.fuels.reduce((s, f) => s + (f.prixod || 0) * (f.tannarx || 0), 0);
    const profit = dayRevenue - dayExp - dayCost;
    const prevDay = i > 0 ? filtered[i-1] : null;
    const prevProfit = prevDay ? prevDay.fuels.reduce((s, f) => s + f.sold * f.price, 0) - prevDay.expenses.reduce((s, e) => s + e.amount, 0) - prevDay.fuels.reduce((s, f) => s + (f.prixod || 0) * (f.tannarx || 0), 0) : profit;
    return { date: d.date.slice(5), foyda: profit, color: profit >= prevProfit ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)' };
  });

  const stationComparison = compareMode ? company.stations.map((name, idx) => {
    const sData = getFilteredData(idx);
    const rev = sData.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
    const exp = sData.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0);
    const cost = sData.reduce((s, d) => s + d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0), 0);
    return { name, revenue: rev, expenses: exp, cost, profit: rev - exp - cost };
  }) : [];

  const saveConf = () => {
    updateCompany(company.key, c => ({ ...c, conf: { ...c.conf, fix: fixCost } }));
    refreshCompany();
    toast.success("Sozlamalar saqlandi!");
  };

  const exportPdf = () => {
    const doc = createPdf('MOLIYA VA TAHLIL', from, to);
    let y = 36;
    doc.setFontSize(12); doc.text("Umumiy ko'rsatkichlar", 14, y); y += 6;
    y = addTable(doc, [["Ko'rsatkich", 'Summa']], [['Tushum', formatNum(revenue) + " so'm"], ['Xarajatlar', formatNum(Math.round(expenses)) + " so'm"], ['Tannarx', formatNum(costTotal) + " so'm"], ['SOF FOYDA', formatNum(net) + " so'm"]], y);
    y += 8; doc.setFontSize(12); doc.text('Kunlik tafsilot', 14, y); y += 6;
    const body = filtered.map(d => { const rev = d.fuels.reduce((a, f) => a + f.sold * f.price, 0); const exp = d.expenses.reduce((a, e) => a + e.amount, 0); const cost = d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0); return [d.date, formatNum(rev), formatNum(exp), formatNum(cost), formatNum(rev - exp - cost)]; });
    y = addTable(doc, [['Sana', 'Tushum', 'Xarajat', 'Tannarx', 'Foyda']], body, y);
    y = addSummaryRow(doc, 'JAMI SOF FOYDA:', formatNum(net) + " so'm", y);
    downloadPdf(doc, `moliya_${from}_${to}.pdf`);
    toast.success('PDF yuklandi!');
  };

  const DiffBadge = ({ value, unit }: { value: number; unit?: string }) => {
    if (value === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0</span>;
    const isPos = value > 0;
    return (
      <span className={`text-xs font-medium flex items-center gap-0.5 ${isPos ? 'text-success' : 'text-destructive'}`}>
        {isPos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {isPos ? '+' : ''}{typeof unit === 'string' ? `${value.toLocaleString()} ${unit}` : formatCurrency(Math.abs(value))}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">MOLIYA VA TAHLIL</h1>

      <GlassCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
          <Button onClick={exportPdf} variant="outline" className="gap-2"><FileDown className="h-4 w-4" />PDF yuklab olish</Button>
          {hasMultiStations && (
            <Button variant={compareMode ? 'default' : 'outline'} onClick={() => setCompareMode(!compareMode)} className="gap-2 btn-glow">
              {compareMode ? '✓ Solishtirish' : 'Zapravkalarni solishtirish'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Bugun sotildi</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={todaySales} formatter={v => v.toLocaleString()} /> L</p>
            <DiffBadge value={salesDiff} unit="L" />
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Bugungi tushum</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={todayRevenue} formatter={formatCurrency} /></p>
            <DiffBadge value={revenueDiff} />
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Tushum</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={revenue} formatter={formatCurrency} /></p>
          </GlassCard>
          <GlassCard hover={false} className={`!p-4 ${net >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs text-muted-foreground">SOF FOYDA</span></div>
            <p className={`text-xl font-bold ${net >= 0 ? 'text-success' : 'text-destructive'}`}><AnimatedCounter value={net} formatter={formatCurrency} /></p>
          </GlassCard>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Xarajatlar</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={Math.round(expenses)} formatter={formatCurrency} /></p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-warning" /><span className="text-xs text-muted-foreground">Tannarx</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={costTotal} formatter={formatCurrency} /></p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami sotuv (L)</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold, 0), 0)} /> L</p>
          </GlassCard>
        </div>
      </GlassCard>

      {/* Station comparison */}
      {compareMode && hasMultiStations && (
        <GlassCard className="mb-6">
          <h3 className="font-semibold text-foreground mb-4">Zapravkalar solishtirmasi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/50">
                <th className="text-left py-2 px-3 text-muted-foreground text-xs font-medium">Zapravka</th>
                <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Tushum</th>
                <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Xarajatlar</th>
                <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Tannarx</th>
                <th className="text-right py-2 px-3 text-muted-foreground text-xs font-medium">Foyda</th>
              </tr></thead>
              <tbody>
                {stationComparison.map((s, i) => (
                  <tr key={i} className="border-b border-border/30 table-row-hover">
                    <td className="py-2 px-3 font-medium">{s.name}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(s.revenue)}</td>
                    <td className="py-2 px-3 text-right text-destructive">{formatCurrency(s.expenses)}</td>
                    <td className="py-2 px-3 text-right text-warning">{formatCurrency(s.cost)}</td>
                    <td className={`py-2 px-3 text-right font-bold ${s.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(s.profit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-2 px-3">JAMI</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(stationComparison.reduce((s, x) => s + x.revenue, 0))}</td>
                  <td className="py-2 px-3 text-right text-destructive">{formatCurrency(stationComparison.reduce((s, x) => s + x.expenses, 0))}</td>
                  <td className="py-2 px-3 text-right text-warning">{formatCurrency(stationComparison.reduce((s, x) => s + x.cost, 0))}</td>
                  <td className="py-2 px-3 text-right text-success">{formatCurrency(stationComparison.reduce((s, x) => s + x.profit, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stationComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Tushum" fill="hsl(221 83% 53%)" radius={[4,4,0,0]} />
                <Bar dataKey="profit" name="Foyda" fill="hsl(142 71% 45%)" radius={[4,4,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="font-semibold text-foreground mb-4">Kunlik foyda dinamikasi</h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={candleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="foyda" name="Foyda" radius={[4,4,0,0]}>
                  {candleData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
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
        </GlassCard>
      </div>

      <GlassCard className="mt-6">
        <h3 className="font-semibold text-foreground mb-4">Sozlamalar</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm">Doimiy oylik xarajat</Label>
            <Input type="number" value={fixCost || ''} onChange={e => setFixCost(Number(e.target.value))} placeholder="Masalan: 2 500 000" className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Ijara, kommunal va boshqa doimiy xarajatlar</p>
          </div>
          <Button onClick={saveConf} className="btn-glow">SAQLASH</Button>
        </div>
      </GlassCard>
    </div>
  );
}
