import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanyByKey } from '@/lib/store';
import { formatCurrency, formatNumber, formatDate, formatDateTime, PLANS } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Building2, Users, Fuel, Calendar, FileText, Shield,
  MapPin, Phone, BarChart3, Clock, User
} from 'lucide-react';

export default function CompanyViewPage() {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();

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

  const totalRevenue = company.data.reduce((s, d) => s + d.fuels.reduce((a, f) => a + f.sold * f.price, 0), 0);
  const totalExpenses = company.data.reduce((s, d) => s + d.expenses.reduce((a, e) => a + e.amount, 0), 0);
  const lastDay = company.data[company.data.length - 1];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Orqaga
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {company.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Faqat ko'rish rejimi — o'zgartirib bo'lmaydi</p>
        </div>
        <span className="bg-secondary text-secondary-foreground text-xs px-3 py-1.5 rounded-lg font-semibold">
          {plan?.name || company.plan}
        </span>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Info cards row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InfoCard icon={Shield} label="Holat" value={statusLabel} />
          <InfoCard icon={Calendar} label="Yaratilgan" value={formatDate(company.created_at)} />
          <InfoCard icon={Phone} label="Telefon" value={company.phone} />
          <InfoCard icon={Users} label="Foydalanuvchilar" value={String(company.users.length)} />
        </div>

        {/* Subscription info */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Obuna ma'lumotlari
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Sinov tugashi</p>
              <p className="font-medium text-foreground">{formatDate(company.subscription.trial_end_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Obuna tugashi</p>
              <p className="font-medium text-foreground">{company.subscription.active_until ? formatDate(company.subscription.active_until) : '-'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Promokod</p>
              <p className="font-medium text-foreground">{company.promocode}</p>
            </div>
          </div>
        </div>

        {/* Stations */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Shaxobchalar ({company.stations.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {company.stations.map((s, i) => (
              <span key={i} className="bg-accent text-accent-foreground text-sm px-3 py-1.5 rounded-lg font-medium">{s}</span>
            ))}
          </div>
        </div>

        {/* Fuel Types */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Fuel className="h-4 w-4 text-primary" /> Yoqilg'i turlari
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {company.fuelTypes.map(ft => {
              const lastFuel = lastDay?.fuels.find(f => f.type === ft.name);
              return (
                <div key={ft.name} className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="font-semibold text-sm text-foreground">{ft.name}</p>
                  <p className="text-xs text-muted-foreground">{ft.unit}</p>
                  {lastFuel && (
                    <p className="text-xs text-primary font-medium mt-1">Qoldiq: {formatNumber(lastFuel.end)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue summary */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Jami daromad</p>
            <p className="text-2xl font-extrabold text-success mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{company.data.length} kun ma'lumotlari</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Jami xarajatlar</p>
            <p className="text-2xl font-extrabold text-destructive mt-1">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sof foyda</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">{formatCurrency(totalRevenue - totalExpenses)}</p>
          </div>
        </div>

        {/* Users list */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Foydalanuvchilar ({company.users.length})
          </h2>
          <div className="space-y-2">
            {company.users.map(u => (
              <div key={u.login} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-foreground">{u.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">@{u.login}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                  u.role === 'BOSS' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                }`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent records */}
        {company.data.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Oxirgi ma'lumotlar (7 kun)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    {['Sana', 'Operator', 'Jami sotuv', 'Terminal', 'Xarajatlar'].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-muted-foreground font-semibold text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {company.data.slice(-7).reverse().map(d => (
                    <tr key={d.date} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="py-2 px-3 font-medium">{d.date}</td>
                      <td className="py-2 px-3 text-muted-foreground">{d.operator}</td>
                      <td className="py-2 px-3 font-semibold text-success">
                        {formatCurrency(d.fuels.reduce((s, f) => s + f.sold * f.price, 0))}
                      </td>
                      <td className="py-2 px-3">{formatCurrency(d.terminal)}</td>
                      <td className="py-2 px-3 text-destructive">
                        {formatCurrency(d.expenses.reduce((s, e) => s + e.amount, 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Logs */}
        {company.logs.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Harakatlar tarixi (oxirgi 20)
            </h2>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {company.logs.slice(-20).reverse().map((log, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-muted-foreground w-32 shrink-0">{formatDateTime(log.timestamp)}</span>
                  <span className="font-medium text-foreground">{log.user}</span>
                  <span className="text-muted-foreground">—</span>
                  <span className="text-foreground">{log.action}</span>
                  {log.detail && <span className="text-muted-foreground truncate">{log.detail}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
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
