import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MinusCircle, FileDown } from 'lucide-react';
import { createPdf, addTable, addSummaryRow, downloadPdf, formatNum } from '@/lib/pdf';
import { toast } from 'sonner';

export default function ExpensesPage() {
  const { company } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [category, setCategory] = useState('all');

  if (!company) return null;

  const allExpenses = company.data.flatMap(d =>
    d.expenses.map(e => ({ ...e, date: d.date, operator: d.operator }))
  );
  const categories = [...new Set(allExpenses.map(e => e.reason))];
  const filtered = allExpenses.filter(e =>
    isInRange(e.date, from, to) && (category === 'all' || e.reason === category)
  );
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const exportPdf = () => {
    const doc = createPdf('XARAJATLAR', from, to);
    let y = 36;
    const body = filtered.map(e => [formatDate(e.date), e.reason, formatNum(e.amount) + ' so\'m', e.operator]);
    y = addTable(doc, [['Sana', 'Sabab', 'Summa', 'Operator']], body, y);
    y = addSummaryRow(doc, 'JAMI XARAJATLAR:', formatNum(total) + ' so\'m', y);
    downloadPdf(doc, `xarajatlar_${from}_${to}.pdf`);
    toast.success('PDF yuklandi!');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">XARAJATLAR</h1>
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
          <div>
            <Label className="text-xs">Tur</Label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">Barchasi</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button onClick={exportPdf} variant="outline" className="gap-2"><FileDown className="h-4 w-4" />PDF yuklab olish</Button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <MinusCircle className="h-5 w-5 text-destructive" />
          <span className="text-lg font-bold text-foreground">Jami: {formatCurrency(total)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Sana</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Sabab</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Summa</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Operator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              ) : filtered.map((e, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-3">{formatDate(e.date)}</td>
                  <td className="py-2 px-3">{e.reason}</td>
                  <td className="py-2 px-3 text-right font-medium text-destructive">{formatCurrency(e.amount)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{e.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
