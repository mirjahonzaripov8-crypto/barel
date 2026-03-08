import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Unlock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SecurityPage() {
  const { company, refreshCompany } = useAuth();
  const [op1, setOp1] = useState(company?.ops.op1 || '');
  const [op2, setOp2] = useState(company?.ops.op2 || '');

  if (!company) return null;

  const toggleLock = (key: 'plomba' | 'start' | 'main') => {
    updateCompany(company.key, c => ({
      ...c,
      locks: { ...c.locks, [key]: !c.locks[key] },
    }));
    refreshCompany();
    toast.success(`${key} ${company.locks[key] ? 'ochildi' : 'bloklandi'}!`);
  };

  const saveOps = () => {
    updateCompany(company.key, c => ({
      ...c,
      ops: { op1, op2 },
    }));
    refreshCompany();
    toast.success("Operatorlar saqlandi!");
  };

  const sysReset = () => {
    if (!confirm("DIQQAT! Barcha ma'lumotlar o'chiriladi. Davom etasizmi?")) return;
    if (!confirm("Bu amalni ortga qaytarib bo'lmaydi. Ishonchingiz komilmi?")) return;
    updateCompany(company.key, c => ({
      ...c,
      data: [],
      logs: [],
      plomba: [],
    }));
    refreshCompany();
    toast.success("Tizim tozalandi!");
  };

  const locks = [
    { key: 'plomba' as const, label: 'Plomba kiritish' },
    { key: 'start' as const, label: 'Boshlang\'ich raqam' },
    { key: 'main' as const, label: 'Asosiy kiritish' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">XAVFSIZLIK</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Locks */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Blokirovkalar</h3>
          <div className="space-y-3">
            {locks.map(l => (
              <div key={l.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <span className="text-sm font-medium text-foreground">{l.label}</span>
                <Button
                  variant={company.locks[l.key] ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => toggleLock(l.key)}
                  className="min-w-[100px]"
                >
                  {company.locks[l.key] ? <><Lock className="h-3 w-3 mr-1" /> YOPIQ</> : <><Unlock className="h-3 w-3 mr-1" /> OCHIQ</>}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Operators & Reset */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <h3 className="font-semibold text-foreground mb-4">Operatorlar</h3>
            <div className="space-y-3">
              <div><Label className="text-xs">Operator 1</Label><Input value={op1} onChange={e => setOp1(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Operator 2</Label><Input value={op2} onChange={e => setOp2(e.target.value)} className="mt-1" /></div>
              <Button onClick={saveOps} className="w-full">OPERATORLARNI SAQLASH</Button>
            </div>
          </div>

          <div className="bg-card border border-destructive/30 rounded-lg p-4 md:p-6">
            <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2"><Trash2 className="h-4 w-4" /> Xavfli zona</h3>
            <p className="text-sm text-muted-foreground mb-4">Barcha sotuv, log va plomba ma'lumotlarini o'chiradi.</p>
            <Button variant="destructive" onClick={sysReset} className="w-full">TIZIMNI TO'LIQ TOZALASH</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
