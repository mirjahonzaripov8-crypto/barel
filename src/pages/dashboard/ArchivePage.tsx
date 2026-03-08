import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Archive, Edit } from 'lucide-react';
import { updateCompany } from '@/lib/store';
import { toast } from 'sonner';

export default function ArchivePage() {
  const { company, refreshCompany } = useAuth();
  const [from, setFrom] = useState(getMonthAgoStr());
  const [to, setTo] = useState(getTodayStr());
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);

  if (!company) return null;

  const filtered = company.data.filter(d => isInRange(d.date, from, to));

  const rows = filtered.flatMap((d, di) =>
    d.fuels.map(f => ({
      dataIdx: company.data.indexOf(d),
      date: d.date,
      type: f.type,
      start: f.start,
      sold: f.sold,
      end: f.end,
      price: f.price,
      total: f.sold * f.price,
      expenses: d.expenses.reduce((s, e) => s + e.amount, 0),
    }))
  );

  const openEdit = (idx: number) => {
    const pw = prompt("Tahrirlash uchun maxsus parolni kiriting:");
    if (pw !== '20113') { toast.error("Parol noto'g'ri!"); return; }
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">ARXIV VA TARIX</h1>
      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div><Label className="text-xs">Dan</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Gacha</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 w-40" /></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                {['Sana','Turi','Boshl.','Sotilgan','Oxirgi','Narx','Jami','Xarajat','Amal'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Ma'lumot topilmadi</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2 px-2">{formatDate(r.date)}</td>
                  <td className="py-2 px-2">{r.type}</td>
                  <td className="py-2 px-2">{r.start.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.sold.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.end.toLocaleString()}</td>
                  <td className="py-2 px-2">{r.price.toLocaleString()}</td>
                  <td className="py-2 px-2 font-medium">{formatCurrency(r.total)}</td>
                  <td className="py-2 px-2 text-destructive">{formatCurrency(r.expenses)}</td>
                  <td className="py-2 px-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r.dataIdx)} className="h-7 text-xs"><Edit className="h-3 w-3 mr-1" /> Tahrir</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
