import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getTodayStr, formatCurrency, formatNumber } from '@/lib/helpers';
import { updateCompany, addLog } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Gauge, Plus, Trash2, PackagePlus, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function MeterPage() {
  const { company, user, refreshCompany } = useAuth();
  const [date, setDate] = useState(getTodayStr());
  const [operator, setOperator] = useState(company?.ops.op1 || '');
  const [fuels, setFuels] = useState<{ type: string; start: number; sold: number; end: number; price: number; prixod: number; tannarx: number }[]>([]);
  const [expenses, setExpenses] = useState<{ reason: string; amount: number }[]>([]);
  const [terminal, setTerminal] = useState(0);

  // Get previous day's end value for a fuel type (before given date)
  const getPreviousEnd = useCallback((fuelType: string, beforeDate: string): number => {
    if (!company?.data.length) return 0;
    const sorted = [...company.data]
      .filter(d => d.date < beforeDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    for (const day of sorted) {
      const fuel = day.fuels.find(f => f.type === fuelType);
      if (fuel && fuel.end > 0) return fuel.end;
    }
    return 0;
  }, [company?.data]);

  // Load data when date or company changes
  useEffect(() => {
    if (!company) return;

    const existing = company.data.find(d => d.date === date);
    if (existing) {
      // Load existing record
      setOperator(existing.operator);
      setFuels(existing.fuels.map(f => ({
        type: f.type,
        start: f.start,
        sold: f.sold,
        end: f.end,
        price: f.price,
        prixod: f.prixod || 0,
        tannarx: f.tannarx || 0,
      })));
      setExpenses(existing.expenses || []);
      setTerminal(existing.terminal || 0);
    } else {
      // New day - start = previous day's end
      setFuels(company.fuelTypes.map(ft => {
        const prevEnd = getPreviousEnd(ft.name, date);
        return {
          type: ft.name,
          start: prevEnd,
          sold: 0,
          end: 0,
          price: company.conf.prices[ft.name] || 0,
          prixod: 0,
          tannarx: 0,
        };
      }));
      setExpenses([]);
      setTerminal(0);
      setOperator(company.ops.op1 || '');
    }
  }, [date, company, getPreviousEnd]);

  if (!company) return null;

  // Sotilgan = Oxirgi - Boshlang'ich + Prixod
  // Hisoblagich o'sib boradi, Oxirgi > Boshlang'ich
  const updateFuel = (i: number, key: string, val: number) => {
    const f = [...fuels];
    (f[i] as any)[key] = val;

    if (key === 'end' || key === 'start' || key === 'prixod') {
      f[i].sold = Math.max(0, f[i].end - f[i].start + f[i].prixod);
    }
    setFuels(f);
  };

  const addExpense = () => setExpenses([...expenses, { reason: '', amount: 0 }]);
  const removeExpense = (i: number) => setExpenses(expenses.filter((_, idx) => idx !== i));
  const updateExpense = (i: number, key: string, val: any) => {
    const e = [...expenses]; (e[i] as any)[key] = val; setExpenses(e);
  };

  const save = () => {
    if (!date || !operator.trim()) { toast.error("Sana va operatorni kiriting!"); return; }

    const hasEnd = fuels.some(f => f.end > 0);
    if (!hasEnd) { toast.error("Kamida bitta yoqilg'i uchun oxirgi ko'rsatkichni kiriting!"); return; }

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

  // Calculate totals for summary
  const totalSales = fuels.reduce((s, f) => s + f.sold * f.price, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

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
            <div key={f.type} className="p-4 border border-border rounded-lg bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />{f.type}
                </p>
                {f.sold > 0 && f.price > 0 && (
                  <span className="text-xs font-medium text-primary">
                    {formatCurrency(f.sold * f.price)}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <Label className="text-xs">Boshlang'ich</Label>
                  <Input
                    type="number"
                    value={f.start || ''}
                    onChange={e => updateFuel(i, 'start', Number(e.target.value))}
                    className="mt-1 bg-muted/50"
                    disabled={isLocked}
                  />
                  {f.start > 0 && <span className="text-[10px] text-muted-foreground">Oldingi kundan</span>}
                </div>
                <div>
                  <Label className="text-xs">Oxirgi ko'rsatkich</Label>
                  <Input
                    type="number"
                    value={f.end || ''}
                    onChange={e => updateFuel(i, 'end', Number(e.target.value))}
                    className="mt-1 border-primary/50 focus:border-primary"
                    disabled={isLocked}
                    placeholder="Kiriting"
                  />
                </div>
                <div>
                  <Label className="text-xs">Sotilgan</Label>
                  <Input type="number" value={f.sold || ''} className="mt-1 bg-muted font-semibold text-primary" disabled />
                  <span className="text-[10px] text-muted-foreground">Avtomatik</span>
                </div>
                <div>
                  <Label className="text-xs">Sotuv narxi</Label>
                  <Input type="number" value={f.price || ''} onChange={e => updateFuel(i, 'price', Number(e.target.value))} className="mt-1" disabled={isLocked} />
                </div>
              </div>

              {/* Prixod (incoming) row */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
                <div className="flex items-center gap-2 col-span-2 mb-1">
                  <PackagePlus className="h-4 w-4 text-success" />
                  <span className="text-xs font-semibold text-success">Prixod (kirish)</span>
                </div>
                <div><Label className="text-xs">Kirgan miqdor ({company.fuelTypes.find(ft => ft.name === f.type)?.unit || 'L'})</Label><Input type="number" value={f.prixod || ''} onChange={e => updateFuel(i, 'prixod', Number(e.target.value))} className="mt-1" disabled={isLocked} placeholder="0" /></div>
                <div><Label className="text-xs">Tannarx (so'm)</Label><Input type="number" value={f.tannarx || ''} onChange={e => updateFuel(i, 'tannarx', Number(e.target.value))} className="mt-1" disabled={isLocked} placeholder="0" /></div>
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

        {/* Summary */}
        {totalSales > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Jami sotuv:</span><span className="font-semibold">{formatCurrency(totalSales)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Terminal:</span><span>{formatCurrency(terminal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Xarajatlar:</span><span>{formatCurrency(totalExpenses)}</span></div>
            <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Naqd pul:</span><span className="font-bold text-primary">{formatCurrency(totalSales - terminal - totalExpenses)}</span></div>
          </div>
        )}

        <Button onClick={save} disabled={isLocked} className="shadow-button hover:-translate-y-0.5 transition-transform">
          <Save className="h-4 w-4 mr-2" /> SAQLASH
        </Button>
      </div>
    </div>
  );
}
