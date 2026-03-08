import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber } from '@/lib/helpers';
import { getStationFuelTypes, getCurrentStation } from '@/lib/store';
import { Fuel, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function HomePage() {
  const { company } = useAuth();
  if (!company) return null;

  const lastDay = company.data[company.data.length - 1];
  const fuelStats = company.fuelTypes.flatMap(ft => {
    const count = ft.meterCount || 1;
    const meters = [];
    for (let m = 0; m < count; m++) {
      const label = count > 1 ? `${ft.name} #${m + 1}` : ft.name;
      const fuel = lastDay?.fuels.find(f => f.type === label);
      meters.push({
        name: label,
        unit: ft.unit,
        remaining: fuel ? fuel.end : 0,
        lastSold: fuel ? fuel.sold : 0,
      });
    }
    return meters;
  });

  const chartData = company.data.slice(-7).map(d => ({
    date: d.date.slice(5),
    sotuv: d.fuels.reduce((sum, f) => sum + f.sold * f.price, 0),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">BOSHQARUV PANELI</h1>

      {/* Fuel stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 stagger-children">
        {fuelStats.map(f => (
          <div key={f.name} className="bg-card border border-border rounded-lg p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">{f.name}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{formatNumber(f.remaining)} <span className="text-xs text-muted-foreground">{f.unit}</span></p>
            <p className="text-xs text-muted-foreground mt-1">Oxirgi sotuv: {formatNumber(f.lastSold)} {f.unit}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Oy bo'yicha sotuv grafikasi</h2>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213 94% 87%)" />
              <XAxis dataKey="date" fontSize={12} stroke="hsl(215 16% 47%)" />
              <YAxis fontSize={12} stroke="hsl(215 16% 47%)" tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Sana: ${l}`} />
              <Line type="monotone" dataKey="sotuv" stroke="hsl(221 83% 53%)" strokeWidth={2.5} dot={{ fill: 'hsl(221 83% 53%)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
