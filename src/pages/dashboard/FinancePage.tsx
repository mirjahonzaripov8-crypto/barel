import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber, getMonthAgoStr, getTodayStr, isInRange, getWeekAgoStr } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, FileDown, ArrowUp, ArrowDown, Minus, Percent } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { updateCompany, getStationData, getCurrentStation, getBaseFuelName } from '@/lib/store';
import { toast } from 'sonner';
import { createPdf, addTable, addSummaryRow, downloadPdf, formatNum } from '@/lib/pdf';
import GlassCard from '@/components/GlassCard';
import AnimatedCounter from '@/components/AnimatedCounter';

const COLORS = ['#2563EB', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899'];
const COLORS_STATIONS = ['hsl(221 83% 53%)', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(262 83% 58%)'];

type FilterPreset = 'custom' | 'today' | 'yesterday' | 'week' | 'month' | 'year';

export default function FinancePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [fixCost, setFixCost] = useState(company?.conf.fix || 0);
  const [compareMode, setCompareMode] = useState(false);
  const [preset, setPreset] = useState<FilterPreset>('month');

  if (!company) return null;

  const stationIdx = getCurrentStation();
  const hasMultiStations = company.stations.length > 1;

  const applyPreset = (p: FilterPreset) => {
    setPreset(p);
    const now = new Date();
    const todayStr = getTodayStr();
    if (p === 'today') { setFrom(todayStr); setTo(todayStr); }
    else if (p === 'yesterday') { const y = new Date(now.getTime() - 86400000).toISOString().split('T')[0]; setFrom(y); setTo(y); }
    else if (p === 'week') { setFrom(getWeekAgoStr()); setTo(todayStr); }
    else if (p === 'month') { setFrom(getMonthAgoStr()); setTo(todayStr); }
    else if (p === 'year') { const y = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]; setFrom(y); setTo(todayStr); }
  };

  const getFilteredData = (sIdx: number) => getStationData(company, sIdx).filter(d => isInRange(d.date, from, to));
  const filtered = getFilteredData(stationIdx);

  const revenue = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  const expenses = filtered.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0) + fixCost * filtered.length / 30;
  const costTotal = filtered.reduce((s, d) => s + d.fuels.reduce((a, f) => a + (f.prixod || 0) * (f.tannarx || 0), 0), 0);
  const net = revenue - expenses - costTotal;
  const profitMargin = revenue > 0 ? (net / revenue) * 100 : 0;

  const today = getTodayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const todayData = getStationData(company, stationIdx).find(d => d.date === today);
  const yesterdayData = getStationData(company, stationIdx).find(d => d.date === yesterday);
  const dayBeforeData = getStationData(company, stationIdx).find(d => d.date === dayBefore);
  
  const todaySales = todayData ? todayData.fuels.reduce((s, f) => s + f.sold, 0) : 0;
  const yesterdaySales = yesterdayData ? yesterdayData.fuels.reduce((s, f) => s + f.sold, 0) : 0;
  const salesDiff = todaySales - yesterdaySales;

  // Yesterday revenue & profit for diff
  const yesterdayRev = yesterdayData ? yesterdayData.fuels.reduce((s, f) => s + f.sold * f.price, 0) : 0;
  const yesterdayExp = yesterdayData ? yesterdayData.expenses.reduce((s, e) => s + e.amount, 0) : 0;
  const yesterdayCost = yesterdayData ? yesterdayData.fuels.reduce((s, f) => s + (f.prixod || 0) * (f.tannarx || 0), 0) : 0;
  const yesterdayProfit = yesterdayRev - yesterdayExp - yesterdayCost;

  const dayBeforeRev = dayBeforeData ? dayBeforeData.fuels.reduce((s, f) => s + f.sold * f.price, 0) : 0;
  const dayBeforeExp = dayBeforeData ? dayBeforeData.expenses.reduce((s, e) => s + e.amount, 0) : 0;
  const dayBeforeCost = dayBeforeData ? dayBeforeData.fuels.reduce((s, f) => s + (f.prixod || 0) * (f.tannarx || 0), 0) : 0;
  const dayBeforeProfit = dayBeforeRev - dayBeforeExp - dayBeforeCost;
  
  const profitDiff = yesterdayProfit - dayBeforeProfit;

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

  // Overall totals when comparing
  const overallRevenue = compareMode ? company.stations.reduce((s, _, idx) => {
    const sData = getFilteredData(idx);
    return s + sData.reduce((sum, d) => sum + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  }, 0) : revenue;
  const overallNet = compareMode ? stationComparison.reduce((s, x) => s + x.profit, 0) : net;

  // Station daily profit comparison
  const stationDailyProfit = compareMode ? (() => {
    const allDates = new Set<string>();
    company.stations.forEach((_, idx) => {
      getFilteredData(idx).forEach(d => allDates.add(d.date));
    });
    return [...allDates].sort().map(date => {
      const entry: any = { date: date.slice(5) };
      company.stations.forEach((name, idx) => {
        const dayData = getFilteredData(idx).find(d => d.date === date);
        if (dayData) {
          const rev = dayData.fuels.reduce((s, f) => s + f.sold * f.price, 0);
          const exp = dayData.expenses.reduce((s, e) => s + e.amount, 0);
          const cost = dayData.fuels.reduce((s, f) => s + (f.prixod || 0) * (f.tannarx || 0), 0);
          entry[name] = rev - exp - cost;
        } else {
          entry[name] = 0;
        }
      });
      return entry;
    });
  })() : [];

  const saveConf = () => {
    updateCompany(company.key, c => ({ ...c, conf: { ...c.conf, fix: fixCost } }));
    refreshCompany();
    toast.success("Sozlamalar saqlandi!");
  };

  const exportPdf = () => {
    const doc = createPdf('MOLIYA VA TAHLIL', from, to);
    let y = 36;
    doc.setFontSize(12); doc.text("Umumiy ko'rsatkichlar", 14, y); y += 6;
    y = addTable(doc, [["Ko'rsatkich", 'Summa']], [['Tushum', formatNum(revenue) + " so'm"], ['Xarajatlar', formatNum(Math.round(expenses)) + " so'm"], ['Tannarx', formatNum(costTotal) + " so'm"], ['SOF FOYDA', formatNum(net) + " so'm"], ['Foyda marjasi', profitMargin.toFixed(1) + '%']], y);
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
          <div className="flex gap-1">
            {([['today', 'Bugun'], ['yesterday', 'Kecha'], ['week', 'Hafta'], ['month', 'Oy'], ['year', 'Yil']] as [FilterPreset, string][]).map(([key, label]) => (
              <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => applyPreset(key)} className="text-xs">
                {label}
              </Button>
            ))}
          </div>
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }} className="mt-1 w-40" /></div>
          <Button onClick={exportPdf} variant="outline" className="gap-2"><FileDown className="h-4 w-4" />PDF yuklab olish</Button>
          {hasMultiStations && (
            <Button variant={compareMode ? 'default' : 'outline'} onClick={() => setCompareMode(!compareMode)} className="gap-2 btn-glow">
              {compareMode ? '✓ Solishtirish' : 'Zapravkalarni solishtirish'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Kecha sotildi</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={yesterdaySales} formatter={v => v.toLocaleString()} /> L</p>
            <DiffBadge value={salesDiff} unit="L" />
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Kechagi tushum</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={yesterdayRev} formatter={formatCurrency} /></p>
            <DiffBadge value={yesterdayRev - dayBeforeRev} />
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Kechagi foyda</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={yesterdayProfit} formatter={formatCurrency} /></p>
            <DiffBadge value={profitDiff} />
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Jami tushum</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={compareMode ? overallRevenue : revenue} formatter={formatCurrency} /></p>
          </GlassCard>
          <GlassCard hover={false} className={`!p-4 ${(compareMode ? overallNet : net) >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4" /><span className="text-xs text-muted-foreground">SOF FOYDA</span></div>
            <p className={`text-xl font-bold ${(compareMode ? overallNet : net) >= 0 ? 'text-success' : 'text-destructive'}`}>
              <AnimatedCounter value={compareMode ? overallNet : net} formatter={formatCurrency} />
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Percent className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Marja: {profitMargin.toFixed(1)}%</span>
            </div>
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
        <>
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

          {/* Daily profit comparison between stations */}
          <GlassCard className="mb-6">
            <h3 className="font-semibold text-foreground mb-4">Kunlik foyda — stantsiyalar solishtirmasi</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stationDailyProfit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  {company.stations.map((name, idx) => (
                    <Line key={name} type="monotone" dataKey={name} stroke={COLORS_STATIONS[idx % COLORS_STATIONS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
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