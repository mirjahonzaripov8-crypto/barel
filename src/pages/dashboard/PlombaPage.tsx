import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, addLog } from '@/lib/store';
import { getTodayStr, formatDate } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PlombaPage() {
  const { company, user, refreshCompany } = useAuth();
  const [date, setDate] = useState(getTodayStr());
  const [numbers, setNumbers] = useState<string[]>(['']);

  if (!company) return null;

  const addNumber = () => setNumbers([...numbers, '']);
  const removeNumber = (i: number) => { if (numbers.length <= 1) return; setNumbers(numbers.filter((_, idx) => idx !== i)); };
  const updateNumber = (i: number, v: string) => { const n = [...numbers]; n[i] = v; setNumbers(n); };

  const save = () => {
    const valid = numbers.filter(n => n.trim());
    if (!date || valid.length === 0) { toast.error("Sana va kamida bitta raqam kiriting!"); return; }
    updateCompany(company.key, c => ({
      ...c,
      plomba: [...c.plomba, { date, numbers: valid, status: 'Yaxshi' }],
    }));
    addLog(company.key, user?.login || '', 'Plomba', `${valid.length} ta plomba saqlandi`);
    refreshCompany();
    setNumbers(['']);
    toast.success("Plomba saqlandi!");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">PLOMBA NAZORATI</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
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
          <Button onClick={save} className="w-full">SAQLASH</Button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Tarix va nazorat</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Sana</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Raqamlar</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Holat</th>
                </tr>
              </thead>
              <tbody>
                {company.plomba.length === 0 ? (
                  <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Ma'lumot yo'q</td></tr>
                ) : company.plomba.slice().reverse().map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 px-2">{formatDate(p.date)}</td>
                    <td className="py-2 px-2">{p.numbers.join(', ')}</td>
                    <td className="py-2 px-2"><span className="bg-success/10 text-success text-xs px-2 py-0.5 rounded-md">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
