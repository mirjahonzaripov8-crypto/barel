import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayStr, formatCurrency } from '@/lib/helpers';
import { updateCompany, addLog } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Gauge, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MeterPage() {
  const { company, user, refreshCompany } = useAuth();
  const [date, setDate] = useState(getTodayStr());
  const [operator, setOperator] = useState(company?.ops.op1 || '');
  const [fuels, setFuels] = useState(
    company?.fuelTypes.map(ft => ({ type: ft.name, start: 0, sold: 0, end: 0, price: 0 })) || []
  );
  const [expenses, setExpenses] = useState<{ reason: string; amount: number }[]>([]);
  const [terminal, setTerminal] = useState(0);

  if (!company) return null;

  const updateFuel = (i: number, key: string, val: number) => {
    const f = [...fuels];
    (f[i] as any)[key] = val;
    if (key === 'start' || key === 'sold') f[i].end = f[i].start + f[i].sold;
    setFuels(f);
  };

  const addExpense = () => setExpenses([...expenses, { reason: '', amount: 0 }]);
  const removeExpense = (i: number) => setExpenses(expenses.filter((_, idx) => idx !== i));
  const updateExpense = (i: number, key: string, val: any) => {
    const e = [...expenses]; (e[i] as any)[key] = val; setExpenses(e);
  };

  const save = () => {
    if (!date || !operator.trim()) { toast.error("Sana va operatorni kiriting!"); return; }

    updateCompany(company.key, c => {
      const existing = c.data.findIndex(d => d.date === date);
      const record = { date, operator, fuels, expenses, terminal };
      if (existing >= 0) {
        c.data[existing] = record;
      } else {
        c.data.push(record);
        c.data.sort((a, b) => a.date.localeCompare(b.date));
      }
      return { ...c };
    });
    addLog(company.key, user?.login || '', 'Hisoblagich', `${date} uchun ma'lumotlar saqlandi`);
    refreshCompany();
    toast.success("Kunlik ma'lumotlar saqlandi!");
  };

  const isLocked = company.locks.main;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">KUNLIK HISOBLAGICH</h1>
        {isLocked && <span className="bg-destructive/10 text-destructive text-xs font-medium px-2 py-1 rounded-md">🔒 BLOKLANGAN</span>}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div><Label className="text-xs">Sana</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-44" disabled={isLocked} /></div>
          <div>
            <Label className="text-xs">Operator</Label>
            <select value={operator} onChange={e => setOperator(e.target.value)} disabled={isLocked} className="mt-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-44">
              <option>{company.ops.op1}</option>
              <option>{company.ops.op2}</option>
            </select>
          </div>
        </div>

        {/* Fuel inputs */}
        <div className="space-y-4 mb-6">
          {fuels.map((f, i) => (
            <div key={f.type} className="p-3 border border-border rounded-lg bg-secondary/20">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Gauge className="h-4 w-4 text-primary" />{f.type}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-xs">Boshlang'ich</Label><Input type="number" value={f.start || ''} onChange={e => updateFuel(i, 'start', Number(e.target.value))} className="mt-1" disabled={isLocked || company.locks.start} /></div>
                <div><Label className="text-xs">Sotilgan</Label><Input type="number" value={f.sold || ''} onChange={e => updateFuel(i, 'sold', Number(e.target.value))} className="mt-1" disabled={isLocked} /></div>
                <div><Label className="text-xs">Oxirgi</Label><Input type="number" value={f.end || ''} className="mt-1 bg-muted" disabled /></div>
                <div><Label className="text-xs">Narx</Label><Input type="number" value={f.price || ''} onChange={e => updateFuel(i, 'price', Number(e.target.value))} className="mt-1" disabled={isLocked} /></div>
              </div>
            </div>
          ))}
        </div>

        {/* Day expenses */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <Label className="font-semibold">Qo'shimcha xarajatlar</Label>
            <Button variant="outline" size="sm" onClick={addExpense} disabled={isLocked}><Plus className="h-3 w-3 mr-1" /> Xarajat qo'shish</Button>
          </div>
          {expenses.map((e, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Input value={e.reason} onChange={ev => updateExpense(i, 'reason', ev.target.value)} placeholder="Sabab" className="flex-1" disabled={isLocked} />
              <Input type="number" value={e.amount || ''} onChange={ev => updateExpense(i, 'amount', Number(ev.target.value))} placeholder="Summa" className="w-32" disabled={isLocked} />
              <Button variant="ghost" size="icon" onClick={() => removeExpense(i)} disabled={isLocked} className="text-destructive shrink-0"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div className="mb-6">
          <Label className="text-xs">Terminal</Label>
          <Input type="number" value={terminal || ''} onChange={e => setTerminal(Number(e.target.value))} className="mt-1 w-44" disabled={isLocked} />
        </div>

        <Button onClick={save} disabled={isLocked} className="shadow-button hover:-translate-y-0.5 transition-transform">SAQLASH</Button>
      </div>
    </div>
  );
}
