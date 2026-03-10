import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatNumber } from '@/lib/helpers';
import { getStationFuelTypes, getCurrentStation, getActiveFeaturesByPlan, getTestingFeaturesByPlan, getAggregatedFuelStats, getStationData } from '@/lib/store';
import { Fuel, BarChart3, Sparkles, TrendingUp, Package, Calendar } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { company } = useAuth();
  const navigate = useNavigate();
  if (!company) return null;

  const customFeatures = [
    ...getActiveFeaturesByPlan(company.plan as any),
    ...getTestingFeaturesByPlan(company.plan as any),
  ];

  const stationIdx = getCurrentStation();
  const stationData = getStationData(company, stationIdx);
  const fuelStats = getAggregatedFuelStats(company, stationIdx);

  // Chart data (last 7 days for this station)
  const chartData = stationData
    .slice(-7)
    .map(d => ({
      date: d.date.slice(5),
      sotuv: d.fuels.reduce((sum, f) => sum + f.sold * f.price, 0),
    }));

  // Color helper for days remaining
  const getStockColor = (days: number) => {
    if (days <= 2) return { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30', dot: 'bg-destructive' };
    if (days <= 4) return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30', dot: 'bg-warning' };
    return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30', dot: 'bg-success' };
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">BOSHQARUV PANELI</h1>

      {/* Fuel stock cards with color indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 stagger-children">
        {fuelStats.map(f => {
          const colors = getStockColor(f.daysRemaining);
          return (
            <div key={f.name} className={`${colors.bg} border ${colors.border} rounded-xl p-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Fuel className={`h-5 w-5 ${colors.text}`} />
                  <span className="text-sm font-bold text-foreground">{f.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} animate-pulse`} />
                  <span className={`text-xs font-semibold ${colors.text}`}>
                    {f.daysRemaining <= 0 ? 'Tugadi' : `${f.daysRemaining} kun`}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> Qoldiq
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {formatNumber(f.remaining)} <span className="text-xs text-muted-foreground">{f.unit}</span>
                  </span>
                </div>
                
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> O'rtacha/kun
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(f.avgDaily)} {f.unit}
                  </span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Oylik sotuv
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatNumber(f.monthSold)} {f.unit}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Oxirgi sotuv</span>
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(f.lastSold)} {f.unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Haftalik sotuv grafikasi</h2>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" fontSize={12} className="fill-muted-foreground" />
              <YAxis fontSize={12} className="fill-muted-foreground" tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={l => `Sana: ${l}`} />
              <Line type="monotone" dataKey="sotuv" className="stroke-primary" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Custom Features */}
      {customFeatures.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Maxsus funksiyalar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customFeatures.map(cf => (
              <button
                key={cf.id}
                onClick={() => navigate(`/dashboard/feature/${cf.id}`)}
                className="bg-card border border-border rounded-lg p-4 text-left hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{cf.title}</span>
                  {cf.status === 'testing' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">test</span>
                  )}
                </div>
                {cf.description && <p className="text-xs text-muted-foreground line-clamp-2">{cf.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
