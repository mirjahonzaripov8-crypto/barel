import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, addLog } from '@/lib/store';
import { getTodayStr, formatDate } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Plus, Trash2, Edit, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import GlassCard from '@/components/GlassCard';

export default function PlombaPage() {
  const { company, user, refreshCompany } = useAuth();
  const [date, setDate] = useState(getTodayStr());
  const [numbers, setNumbers] = useState<string[]>(['']);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editNumbers, setEditNumbers] = useState<string[]>([]);

  if (!company) return null;

  const addNumber = () => setNumbers([...numbers, '']);
  const removeNumber = (i: number) => { if (numbers.length <= 1) return; setNumbers(numbers.filter((_, idx) => idx !== i)); };
  const updateNumber = (i: number, v: string) => { const n = [...numbers]; n[i] = v; setNumbers(n); };

  // Check if plomba is within 10-min edit window
  const canEdit = (plomba: { date: string }) => {
    const created = new Date(plomba.date).getTime();
    const now = Date.now();
    return (now - created) < 10 * 60 * 1000; // 10 daqiqa
  };

  const save = () => {
    const valid = numbers.filter(n => n.trim());
    if (!date || valid.length === 0) { toast.error("Sana va kamida bitta raqam kiriting!"); return; }
    updateCompany(company.key, c => ({
      ...c,
      plomba: [...c.plomba, { date: new Date().toISOString(), numbers: valid, status: 'Yaxshi' }],
    }));
    addLog(company.key, user?.login || '', 'Plomba', `${valid.length} ta plomba saqlandi`);
    refreshCompany();
    setNumbers(['']);
    toast.success("Plomba saqlandi!");
  };

  const startEdit = (idx: number) => {
    const realIdx = company.plomba.length - 1 - idx;
    const p = company.plomba[realIdx];
    if (!canEdit(p)) { toast.error("10 daqiqa o'tdi, tahrirlash mumkin emas!"); return; }
    setEditingIdx(idx);
    setEditNumbers([...p.numbers]);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const realIdx = company.plomba.length - 1 - editingIdx;
    const valid = editNumbers.filter(n => n.trim());
    if (valid.length === 0) { toast.error("Kamida bitta raqam kiriting!"); return; }
    updateCompany(company.key, c => {
      const plomba = [...c.plomba];
      plomba[realIdx] = { ...plomba[realIdx], numbers: valid };
      return { ...c, plomba };
    });
    addLog(company.key, user?.login || '', 'Plomba', 'Plomba tahrirlandi');
    refreshCompany();
    setEditingIdx(null);
    toast.success("Plomba tahrirlandi!");
  };

  const deletePlomba = (idx: number) => {
    const realIdx = company.plomba.length - 1 - idx;
    const p = company.plomba[realIdx];
    if (!canEdit(p)) { toast.error("10 daqiqa o'tdi, o'chirish mumkin emas!"); return; }
    updateCompany(company.key, c => {
      const plomba = [...c.plomba];
      plomba.splice(realIdx, 1);
      return { ...c, plomba };
    });
    addLog(company.key, user?.login || '', 'Plomba', "Plomba o'chirildi");
    refreshCompany();
    toast.success("Plomba o'chirildi!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">PLOMBA NAZORATI</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" /> Yangi plomba</h3>
          <div className="mb-4"><Label className="text-xs">Sana</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-44" /></div>
          <div className="space-y-2 mb-4">
            {numbers.map((n, i) => (
              <div key={i} className="flex gap-2">
                <Input value={n} onChange={e => updateNumber(i, e.target.value)} placeholder={`Raqam ${i+1}`} />
                {numbers.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeNumber(i)} className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addNumber}><Plus className="h-3 w-3 mr-1" /> Raqam qo'shish</Button>
          </div>
          <Button onClick={save} className="w-full btn-glow">SAQLASH</Button>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold text-foreground mb-4">Tarix va nazorat</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Sana</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Raqamlar</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Holat</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium text-xs">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {company.plomba.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Ma'lumot yo'q</td></tr>
                ) : company.plomba.slice().reverse().map((p, i) => {
                  const editable = canEdit(p);
                  const isEditing = editingIdx === i;
                  return (
                    <tr key={i} className="border-b border-border/30 table-row-hover">
                      <td className="py-2 px-2 text-xs">{formatDate(p.date)}</td>
                      <td className="py-2 px-2">
                        {isEditing ? (
                          <div className="space-y-1">
                            {editNumbers.map((n, ni) => (
                              <Input key={ni} value={n} onChange={e => { const en = [...editNumbers]; en[ni] = e.target.value; setEditNumbers(en); }} className="h-7 text-xs" />
                            ))}
                          </div>
                        ) : p.numbers.join(', ')}
                      </td>
                      <td className="py-2 px-2"><span className="bg-success/10 text-success text-xs px-2 py-0.5 rounded-md">{p.status}</span></td>
                      <td className="py-2 px-2 text-right">
                        {editable && !isEditing && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(i)}><Edit className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePlomba(i)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        )}
                        {isEditing && (
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingIdx(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        )}
                        {!editable && <span className="text-xs text-muted-foreground">🔒</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">⏱️ Plomba kiritilgandan so'ng faqat 10 daqiqa ichida tahrirlash mumkin</p>
        </GlassCard>
      </div>
    </div>
  );
}
