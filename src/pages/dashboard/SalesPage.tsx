import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart3, Fuel, TrendingUp, Calendar } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, LineChart, Line } from 'recharts';
import { getCurrentStation, getStationData, getBaseFuelName, getStationFuelTypes } from '@/lib/store';

export default function SalesPage() {
  const { company } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedFuel, setSelectedFuel] = useState('all');

  if (!company) return null;

  const stationIdx = getCurrentStation();
  const hasMultiStations = company.stations.length > 1;
  const stationFuels = getStationFuelTypes(company, stationIdx);

  const getFilteredData = (sIdx: number) => {
    return getStationData(company, sIdx).filter(d => isInRange(d.date, from, to));
  };

  const filtered = getFilteredData(stationIdx);

  // Unique base fuel names
  const fuelNames = stationFuels.map(ft => ft.name);

  // Per-fuel stats
  const fuelSalesStats = fuelNames.map(name => {
    let totalSold = 0;
    let totalRevenue = 0;
    for (const d of filtered) {
      for (const f of d.fuels) {
        if (getBaseFuelName(f.type) === name) {
          totalSold += f.sold;
          totalRevenue += f.sold * f.price;
        }
      }
    }
    const avgDaily = filtered.length > 0 ? totalSold / filtered.length : 0;
    return { name, totalSold, totalRevenue, avgDaily: Math.round(avgDaily) };
  });

  const totalSoldAll = fuelSalesStats.reduce((s, f) => s + f.totalSold, 0);
  const totalRevenueAll = fuelSalesStats.reduce((s, f) => s + f.totalRevenue, 0);
  const avgDailyAll = filtered.length > 0 ? totalSoldAll / filtered.length : 0;

  // Daily candlestick data
  const dailyData = filtered.map((d, i) => {
    const prev = i > 0 ? filtered[i-1] : null;
    const todayTotal = d.fuels
      .filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel)
      .reduce((s, f) => s + f.sold * f.price, 0);
    const prevTotal = prev ? prev.fuels
      .filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel)
      .reduce((s, f) => s + f.sold * f.price, 0) : todayTotal;
    
    const isUp = todayTotal >= prevTotal;
    return {
      date: d.date.slice(5),
      fullDate: d.date,
      sotuv: todayTotal,
      sold: d.fuels
        .filter(f => selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel)
        .reduce((s, f) => s + f.sold, 0),
      color: isUp ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)',
    };
  });

  // Station comparison
  const stationStats = compareMode ? company.stations.map((name, idx) => {
    const sData = getFilteredData(idx);
    let totalSold = 0;
    let totalRevenue = 0;
    for (const d of sData) {
      for (const f of d.fuels) {
        if (selectedFuel === 'all' || getBaseFuelName(f.type) === selectedFuel) {
          totalSold += f.sold;
          totalRevenue += f.sold * f.price;
        }
      }
    }
    const avgDaily = sData.length > 0 ? totalSold / sData.length : 0;
    return { name, totalSold, totalRevenue, avgDaily: Math.round(avgDaily), days: sData.length };
  }) : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">SOTUV TAHLILI</h1>

      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
          <div>
            <Label className="text-xs">Mahsulot</Label>
            <select value={selectedFuel} onChange={e => setSelectedFuel(e.target.value)} className="mt-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">Barchasi</option>
              {fuelNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {hasMultiStations && (
            <Button variant={compareMode ? 'default' : 'outline'} onClick={() => setCompareMode(!compareMode)}>
              {compareMode ? '✓ Solishtirish' : 'Zapravkalar solishtirish'}
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Fuel className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami sotildi</span></div>
            <p className="text-xl font-bold text-foreground">{formatNumber(totalSoldAll)} L</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">Sotuv summasi</span></div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalRevenueAll)}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Calendar className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">O'rtacha/kun</span></div>
            <p className="text-xl font-bold text-foreground">{formatNumber(Math.round(avgDailyAll))} L</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Kunlar soni</span></div>
            <p className="text-xl font-bold text-foreground">{filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Per-fuel breakdown */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Mahsulotlar bo'yicha</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {fuelSalesStats.map(fs => (
            <div key={fs.name} className="bg-secondary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">{fs.name}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sotildi:</span><span className="font-medium">{formatNumber(fs.totalSold)} L</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Summa:</span><span className="font-medium">{formatCurrency(fs.totalRevenue)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">O'rtacha/kun:</span><span className="font-medium">{formatNumber(fs.avgDaily)} L</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Candlestick chart */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Kunlik sotuv diagramasi (yapon shamlari)
        </h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip 
                formatter={(v: number, name: string) => [
                  name === 'sotuv' ? formatCurrency(v) : `${formatNumber(v)} L`, 
                  name === 'sotuv' ? 'Summa' : 'Litr'
                ]} 
              />
              <Bar dataKey="sotuv" name="Sotuv summasi" radius={[3,3,0,0]} barSize={16}>
                {dailyData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume trend line */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6">
        <h3 className="font-semibold text-foreground mb-4">Sotuv hajmi (litr)</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => [`${formatNumber(v)} L`, 'Sotildi']} />
              <Line type="monotone" dataKey="sold" className="stroke-primary" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Station comparison */}
      {compareMode && hasMultiStations && (
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Zapravkalar solishtirmasi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground text-xs">Zapravka</th>
                  <th className="text-right py-2 px-3 text-muted-foreground text-xs">Sotildi (L)</th>
                  <th className="text-right py-2 px-3 text-muted-foreground text-xs">Summa</th>
                  <th className="text-right py-2 px-3 text-muted-foreground text-xs">O'rtacha/kun</th>
                </tr>
              </thead>
              <tbody>
                {stationStats.map((s, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
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
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => formatNumber(v) + ' L'} />
                <Legend />
                <Bar dataKey="totalSold" name="Sotildi (L)" fill="hsl(221 83% 53%)" radius={[4,4,0,0]} />
                <Bar dataKey="avgDaily" name="O'rtacha/kun" fill="hsl(142 71% 45%)" radius={[4,4,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
