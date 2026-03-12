import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber, getMonthAgoStr, getTodayStr, isInRange, getWeekAgoStr } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart3, Fuel, TrendingUp, Calendar, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LineChart, Line } from 'recharts';
import { getCurrentStation, getStationData, getBaseFuelName, getStationFuelTypes } from '@/lib/store';
import GlassCard from '@/components/GlassCard';
import AnimatedCounter from '@/components/AnimatedCounter';

type FilterPreset = 'custom' | 'today' | 'yesterday' | 'week' | 'month' | 'year';

export default function SalesPage() {
  const { company } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState('all');
  const [preset, setPreset] = useState<FilterPreset>('month');

  if (!company) return null;

  const stationIdx = getCurrentStation();
  const hasMultiStations = company.stations.length > 1;
  const stationFuels = getStationFuelTypes(company, stationIdx);

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
  const fuelNames = stationFuels.map(ft => ft.name);

  const fuelSalesStats = fuelNames.map(name => {
    let totalSold = 0, totalRevenue = 0;
    for (const d of filtered) for (const f of d.fuels) if (getBaseFuelName(f.type) === name) { totalSold += f.sold; totalRevenue += f.sold * f.price; }
    return { name, totalSold, totalRevenue, avgDaily: filtered.length > 0 ? Math.round(totalSold / filtered.length) : 0 };
  });

  const totalSoldAll = fuelSalesStats.reduce((s, f) => s + f.totalSold, 0);
  const totalRevenueAll = fuelSalesStats.reduce((s, f) => s + f.totalRevenue, 0);
  const avgDailyAll = filtered.length > 0 ? totalSoldAll / filtered.length : 0;

  // Yesterday vs day before
  const todayStr = getTodayStr();
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const dayBeforeStr = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const allData = getStationData(company, stationIdx);
  const yesterdayData = allData.find(d => d.date === yesterdayStr);
  const dayBeforeData = allData.find(d => d.date === dayBeforeStr);
  
  const yesterdaySold = yesterdayData ? yesterdayData.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold, 0) : 0;
  const dayBeforeSold = dayBeforeData ? dayBeforeData.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold, 0) : 0;
  const soldDiff = yesterdaySold - dayBeforeSold;

  // Candlestick data
  const dailyData = filtered.map((d, i) => {
    const prev = i > 0 ? filtered[i-1] : null;
    const todayTotal = d.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold * f.price, 0);
    const prevTotal = prev ? prev.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold * f.price, 0) : todayTotal;
    return {
      date: d.date.slice(5),
      fullDate: d.date,
      sotuv: todayTotal,
      sold: d.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold, 0),
      color: todayTotal >= prevTotal ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)',
    };
  });

  const stationStats = compareMode ? company.stations.map((name, idx) => {
    const sData = getFilteredData(idx);
    let totalSold = 0, totalRevenue = 0;
    for (const d of sData) for (const f of d.fuels) if (selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel) { totalSold += f.sold; totalRevenue += f.sold * f.price; }
    return { name, totalSold, totalRevenue, avgDaily: sData.length > 0 ? Math.round(totalSold / sData.length) : 0, days: sData.length };
  }) : [];

  // Station comparison daily chart data
  const stationDailyComparison = compareMode ? (() => {
    const allDates = new Set<string>();
    company.stations.forEach((_, idx) => {
      getFilteredData(idx).forEach(d => allDates.add(d.date));
    });
    return [...allDates].sort().map(date => {
      const entry: any = { date: date.slice(5) };
      company.stations.forEach((name, idx) => {
        const dayData = getFilteredData(idx).find(d => d.date === date);
        const rev = dayData ? dayData.fuels.filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel).reduce((s, f) => s + f.sold * f.price, 0) : 0;
        entry[name] = rev;
      });
      return entry;
    });
  })() : [];

  const COLORS_STATIONS = ['hsl(221 83% 53%)', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)', 'hsl(262 83% 58%)'];

  const DiffBadge = ({ value, unit }: { value: number; unit?: string }) => {
    if (value === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0</span>;
    const isPos = value > 0;
    return (
      <span className={`text-xs font-medium flex items-center gap-0.5 ${isPos ? 'text-success' : 'text-destructive'}`}>
        {isPos ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {isPos ? '+' : ''}{formatNumber(Math.abs(value))} {unit || ''}
      </span>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">SOTUV TAHLILI</h1>

      {/* Controls */}
      <GlassCard className="mb-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex gap-1">
            {([['today', 'Bugun'], ['yesterday', 'Kecha'], ['week', 'Hafta'], ['month', 'Oy'], ['year', 'Yil']] as [FilterPreset, string][]).map(([key, label]) => (
              <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'} onClick={() => applyPreset(key)} className="text-xs">
                {label}
              </Button>
            ))}
          </div>
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }} className="mt-1 w-40" /></div>
          <div>
            <Label className="text-xs">Mahsulot</Label>
            <select value={selectedFuel} onChange={e => setSelectedFuel(e.target.value)} className="mt-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">Barchasi</option>
              {fuelNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {hasMultiStations && (
            <Button variant={compareMode ? 'default' : 'outline'} onClick={() => setCompareMode(!compareMode)} className="btn-glow">
              {compareMode ? '✓ Solishtirish' : 'Zapravkalar solishtirish'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><Fuel className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami sotildi</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={totalSoldAll} formatter={formatNumber} /> L</p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Sotuv summasi</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={totalRevenueAll} formatter={formatCurrency} /></p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">O'rtacha/kun</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={Math.round(avgDailyAll)} formatter={formatNumber} /> L</p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Kunlar soni</span></div>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={filtered.length} /></p>
          </GlassCard>
          <GlassCard hover={false} className="!p-4">
            <span className="text-xs text-muted-foreground">Kecha sotildi</span>
            <p className="text-xl font-bold text-foreground"><AnimatedCounter value={yesterdaySold} formatter={formatNumber} /> L</p>
            <DiffBadge value={soldDiff} unit="L" />
          </GlassCard>
        </div>
      </GlassCard>

      {/* Per-fuel */}
      <GlassCard className="mb-6">
        <h3 className="font-semibold text-foreground mb-4">Mahsulotlar bo'yicha</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {fuelSalesStats.map(fs => (
            <GlassCard key={fs.name} hover={false} className="!p-4 bg-white/50">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">{fs.name}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sotildi:</span><span className="font-medium">{formatNumber(fs.totalSold)} L</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Summa:</span><span className="font-medium">{formatCurrency(fs.totalRevenue)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">O'rtacha/kun:</span><span className="font-medium">{formatNumber(fs.avgDaily)} L</span></div>
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassCard>

      {/* Candlestick */}
      <GlassCard className="mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Kunlik sotuv diagramasi (yapon shamlari)
        </h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number, name: string) => [name === 'sotuv' ? formatCurrency(v) : `${formatNumber(v)} L`, name === 'sotuv' ? 'Summa' : 'Litr']} />
              <Bar dataKey="sotuv" name="Sotuv summasi" radius={[3,3,0,0]} barSize={16}>
                {dailyData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Volume trend */}
      <GlassCard className="mb-6">
        <h3 className="font-semibold text-foreground mb-4">Sotuv hajmi (litr)</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} L`, 'Sotildi']} />
              <Line type="monotone" dataKey="sold" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Station comparison */}
      {compareMode && hasMultiStations && (
        <>
          <GlassCard className="mb-6">
            <h3 className="font-semibold text-foreground mb-4">Zapravkalar solishtirmasi</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-muted-foreground text-xs">Zapravka</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs">Sotildi (L)</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs">Summa</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs">O'rtacha/kun</th>
                  </tr>
                </thead>
                <tbody>
                  {stationStats.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 table-row-hover">
                      <td className="py-2 px-3 font-medium">{s.name}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(s.totalSold)} L</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(s.totalRevenue)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(s.avgDaily)} L</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-2 px-3">JAMI</td>
                    <td className="py-2 px-3 text-right">{formatNumber(stationStats.reduce((s, x) => s + x.totalSold, 0))} L</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(stationStats.reduce((s, x) => s + x.totalRevenue, 0))}</td>
                    <td className="py-2 px-3 text-right">{formatNumber(stationStats.reduce((s, x) => s + x.avgDaily, 0))} L</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stationStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.1)" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => formatNumber(v) + ' L'} />
                  <Legend />
                  <Bar dataKey="totalSold" name="Sotildi (L)" fill="hsl(221 83% 53%)" radius={[4,4,0,0]} />
                  <Bar dataKey="avgDaily" name="O'rtacha/kun" fill="hsl(142 71% 45%)" radius={[4,4,0,0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Daily station comparison chart */}
          <GlassCard>
            <h3 className="font-semibold text-foreground mb-4">Kunlik stantsiyalar solishtirmasi (sotuv summasi)</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stationDailyComparison}>
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
    </div>
  );
}