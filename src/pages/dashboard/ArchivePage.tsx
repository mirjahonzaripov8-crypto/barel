import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Edit, FileDown, Fuel, CreditCard, MinusCircle, Banknote } from 'lucide-react';
import { updateCompany, getCurrentStation, getStationData } from '@/lib/store';
import { toast } from 'sonner';
import { createPdf, addTable, addSummaryRow, downloadPdf, formatNum } from '@/lib/pdf';

export default function ArchivePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);

  if (!company) return null;

  const filtered = company.data.filter(d => isInRange(d.date, from, to));

  // Per-row data for table
  const rows = filtered.flatMap((d) =>
    d.fuels.map(f => ({
      dataIdx: company.data.indexOf(d),
      date: d.date,
      type: f.type,
      start: f.start,
      sold: f.sold,
      end: f.end,
      price: f.price,
      total: f.sold * f.price,
    }))
  );

  // Summaries
  const totalSoldLiters = rows.reduce((s, r) => s + r.sold, 0);
  const totalSalesSum = rows.reduce((s, r) => s + r.total, 0);
  const totalTerminal = filtered.reduce((s, d) => s + (d.terminal || 0), 0);
  const allExpenses = filtered.flatMap(d => d.expenses.map(e => ({ ...e, date: d.date })));
  const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
  const naqdPul = totalSalesSum - totalTerminal - totalExpenses;

  const openEdit = (idx: number) => {
    const pw = prompt("Tahrirlash uchun maxsus parolni kiriting:");
    if (pw !== company.securityPassword) { toast.error("Parol noto'g'ri!"); return; }
    const d = company.data[idx];
    setEditIdx(idx);
    setEditData({ ...d, fuels: d.fuels.map(f => ({ ...f })), expenses: d.expenses.map(e => ({ ...e })) });
  };

  const saveEdit = () => {
    if (editIdx === null || !editData) return;
    updateCompany(company.key, c => {
      c.data[editIdx] = editData;
      return { ...c };
    });
    refreshCompany();
    setEditIdx(null);
    setEditData(null);
    toast.success("Tahrirlandi!");
  };

  const exportPdf = () => {
    const doc = createPdf('ARXIV VA TARIX', from, to);
    let y = 36;

    // Sales table
    doc.setFontSize(12);
    doc.text('Sotuv ma\'lumotlari', 14, y);
    y += 6;
    const salesBody = rows.map(r => [
      formatDate(r.date), r.type, formatNum(r.start), formatNum(r.sold),
      formatNum(r.end), formatNum(r.price), formatNum(r.total)
    ]);
    y = addTable(doc, [['Sana', 'Turi', 'Boshl.', 'Sotilgan', 'Oxirgi', 'Narx', 'Jami']], salesBody, y);
    y = addSummaryRow(doc, 'JAMI SOTUV:', formatNum(totalSalesSum) + ' so\'m', y);

    // Terminal
    y += 4;
    doc.setFontSize(12);
    doc.text('Terminal ma\'lumotlari', 14, y);
    y += 6;
    const termBody = filtered.map(d => [formatDate(d.date), formatNum(d.terminal || 0)]);
    y = addTable(doc, [['Sana', 'Terminal summa']], termBody, y);
    y = addSummaryRow(doc, 'JAMI TERMINAL:', formatNum(totalTerminal) + ' so\'m', y);

    // Expenses detail
    y += 4;
    doc.setFontSize(12);
    doc.text('Xarajatlar tafsiloti', 14, y);
    y += 6;
    const expBody = allExpenses.map(e => [formatDate(e.date), e.reason, formatNum(e.amount)]);
    y = addTable(doc, [['Sana', 'Sabab', 'Summa']], expBody, y);
    y = addSummaryRow(doc, 'JAMI XARAJATLAR:', formatNum(totalExpenses) + ' so\'m', y);

    // Final summary
    y += 6;
    y = addSummaryRow(doc, 'NAQD PUL (Sotuv - Terminal - Xarajat):', formatNum(naqdPul) + ' so\'m', y);

    downloadPdf(doc, `arxiv_${from}_${to}.pdf`);
    toast.success('PDF yuklandi!');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">ARXIV VA TARIX</h1>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
          <Button onClick={exportPdf} variant="outline" className="gap-2"><FileDown className="h-4 w-4" />PDF yuklab olish</Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Fuel className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Jami sotilgan</span></div>
            <p className="text-lg font-bold text-foreground">{totalSoldLiters.toLocaleString()} L</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Sotuv summasi</span></div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalSalesSum)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Terminal</span></div>
            <p className="text-lg font-bold text-foreground">{formatCurrency(totalTerminal)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1"><MinusCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Xarajatlar</span></div>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className={`rounded-lg p-3 ${naqdPul >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
            <div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4" /><span className="text-xs text-muted-foreground">NAQD PUL</span></div>
            <p className={`text-lg font-bold ${naqdPul >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(naqdPul)}</p>
          </div>
        </div>

        {/* Sales table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                {['Sana','Turi','Boshl.','Sotilgan','Oxirgi','Narx','Jami','Amal'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-2">{formatDate(r.date)}</td>
                  <td className="py-2 px-2">{r.type}</td>
                  <td className="py-2 px-2">{r.start.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.sold.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.end.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.price.toLocaleString()}</td>
                  <td className="py-2 px-2 font-medium">{formatCurrency(r.total)}</td>
                  <td className="py-2 px-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r.dataIdx)} className="h-7 text-xs"><Edit className="h-3 w-3 mr-1" /> Tahrir</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expenses detail table */}
        {allExpenses.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold text-foreground mb-3">Xarajatlar tafsiloti</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Sana</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Sabab</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium text-xs">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {allExpenses.map((e, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2 px-2">{formatDate(e.date)}</td>
                      <td className="py-2 px-2">{e.reason}</td>
                      <td className="py-2 px-2 text-right font-medium text-destructive">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-bold">
                    <td colSpan={2} className="py-2 px-2">JAMI</td>
                    <td className="py-2 px-2 text-right text-destructive">{formatCurrency(totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit overlay */}
      {editIdx !== null && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-lg animate-scale-in max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground mb-4">Tahrirlash — {formatDate(editData.date)}</h3>
            {editData.fuels.map((f: any, i: number) => (
              <div key={i} className="mb-3 p-3 border border-border rounded-lg">
                <p className="text-sm font-medium mb-2">{f.type}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Boshl.</Label><Input type="number" value={f.start} onChange={e => { const d = {...editData}; d.fuels[i].start = Number(e.target.value); setEditData(d); }} className="mt-1" /></div>
                  <div><Label className="text-xs">Sotilgan</Label><Input type="number" value={f.sold} onChange={e => { const d = {...editData}; d.fuels[i].sold = Number(e.target.value); setEditData(d); }} className="mt-1" /></div>
                  <div><Label className="text-xs">Narx</Label><Input type="number" value={f.price} onChange={e => { const d = {...editData}; d.fuels[i].price = Number(e.target.value); setEditData(d); }} className="mt-1" /></div>
                </div>
              </div>
            ))}
            <div className="flex gap-3 mt-4">
              <Button onClick={saveEdit} className="flex-1">SAQLASH</Button>
              <Button variant="outline" onClick={() => { setEditIdx(null); setEditData(null); }} className="flex-1">BEKOR</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
