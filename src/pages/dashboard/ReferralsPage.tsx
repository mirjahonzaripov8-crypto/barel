import { useAuth } from '@/contexts/AuthContext';
import { getCompanies, getPayments } from '@/lib/store';
import { formatCurrency } from '@/lib/helpers';
import { Gift, Copy, Users, DollarSign, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ReferralsPage() {
  const { company } = useAuth();
  if (!company) return null;

  const allCompanies = getCompanies();
  const payments = getPayments();
  const referred = allCompanies.filter(c => c.referred_by === company.promocode);
  const paidReferred = referred.filter(c => payments.some(p => p.companyKey === c.key && p.status === 'approved'));
  const discount = paidReferred.length * 5; // 5% per paid referral

  const copy = () => {
    navigator.clipboard.writeText(company.promocode);
    toast.success("Nusxalandi!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">MENING REFERALLARIM</h1>

      {/* Promo code */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
        <p className="text-sm text-muted-foreground mb-2">Sizning promokodingiz</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-primary tracking-wider">{company.promocode}</span>
          <Button variant="outline" size="sm" onClick={copy}><Copy className="h-3 w-3 mr-1" /> Nusxalash</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6 stagger-children">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami taklif qilinganlar</span></div>
          <p className="text-2xl font-bold text-foreground">{referred.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-success" /><span className="text-xs text-muted-foreground">To'lov qilganlar</span></div>
          <p className="text-2xl font-bold text-foreground">{paidReferred.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1"><Percent className="h-4 w-4 text-warning" /><span className="text-xs text-muted-foreground">Joriy chegirma</span></div>
          <p className="text-2xl font-bold text-primary">{discount}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <h3 className="font-semibold text-foreground mb-4">Taklif qilingan korxonalar</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Korxona</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Ro'yxatdan o'tgan</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Holat</th>
              </tr>
            </thead>
            <tbody>
              {referred.length === 0 ? (
                <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Hali taklif qilinganlar yo'q</td></tr>
              ) : referred.map(r => {
                const paid = payments.some(p => p.companyKey === r.key && p.status === 'approved');
                return (
                  <tr key={r.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 px-2 font-medium">{r.name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-md ${paid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {paid ? 'To\'langan' : 'Sinov'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
