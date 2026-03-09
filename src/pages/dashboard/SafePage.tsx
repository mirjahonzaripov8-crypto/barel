import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Vault, Plus, Minus, ArrowUpCircle, ArrowDownCircle, Calendar, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/helpers';

export interface SafeTransaction {
  id: string;
  type: 'in' | 'out';
  amount: number;
  reason?: string;
  personName?: string;
  date: string;
  operator: string;
}

function getSafeKey(companyKey: string) {
  return `barel_safe_${companyKey}`;
}

function getSafeTransactions(companyKey: string): SafeTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(getSafeKey(companyKey)) || '[]');
  } catch { return []; }
}

function saveSafeTransactions(companyKey: string, txs: SafeTransaction[]) {
  localStorage.setItem(getSafeKey(companyKey), JSON.stringify(txs));
}

export default function SafePage() {
  const { company, user } = useAuth();
  const [transactions, setTransactions] = useState<SafeTransaction[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [personName, setPersonName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (company) setTransactions(getSafeTransactions(company.key));
  }, [company?.key]);

  const balance = useMemo(() =>
    transactions.reduce((sum, t) => sum + (t.type === 'in' ? t.amount : -t.amount), 0),
    [transactions]
  );

  const filtered = useMemo(() => {
    let list = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (dateFrom) list = list.filter(t => t.date >= dateFrom);
    if (dateTo) list = list.filter(t => t.date <= dateTo + 'T23:59:59');
    return list;
  }, [transactions, dateFrom, dateTo]);

  const totalIn = useMemo(() => filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalOut = useMemo(() => filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0), [filtered]);

  if (!company || !user) return null;

  function addMoney() {
    const val = Number(amount);
    if (!val || val <= 0) { toast.error("Summani kiriting"); return; }
    const tx: SafeTransaction = {
      id: `safe_${Date.now()}`,
      type: 'in',
      amount: val,
      reason: reason.trim() || undefined,
      personName: personName.trim() || undefined,
      date: new Date().toISOString(),
      operator: user!.name,
    };
    const updated = [...transactions, tx];
    setTransactions(updated);
    saveSafeTransactions(company!.key, updated);
    setAmount(''); setReason(''); setPersonName('');
    setAddOpen(false);
    toast.success(`${formatCurrency(val)} seyfga qo'shildi`);
  }

  function withdrawMoney() {
    const val = Number(amount);
    if (!val || val <= 0) { toast.error("Summani kiriting"); return; }
    if (!reason.trim()) { toast.error("Sababni kiriting"); return; }
    if (!personName.trim()) { toast.error("Ism kiriting"); return; }
    if (val > balance) { toast.error("Seyfda yetarli mablag' yo'q"); return; }
    const tx: SafeTransaction = {
      id: `safe_${Date.now()}`,
      type: 'out',
      amount: val,
      reason: reason.trim(),
      personName: personName.trim(),
      date: new Date().toISOString(),
      operator: user!.name,
    };
    const updated = [...transactions, tx];
    setTransactions(updated);
    saveSafeTransactions(company!.key, updated);
    setAmount('');
    setReason('');
    setPersonName('');
    setWithdrawOpen(false);
    toast.success(`${formatCurrency(val)} seyfdan olindi`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Vault className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seyf</h1>
          <p className="text-muted-foreground text-sm">Naqd pul nazorati</p>
        </div>
      </div>

      {/* Balance + Actions */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-1">Seyfda hozir:</p>
        <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
          {formatCurrency(balance)}
        </p>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => { setAmount(''); setAddOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Pul qo'shish
          </Button>
          <Button variant="outline" onClick={() => { setAmount(''); setReason(''); setPersonName(''); setWithdrawOpen(true); }} className="gap-2">
            <Minus className="h-4 w-4" /> Pul olish
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Kirdi</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">Ketdi</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalOut)}</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground text-sm">Sana bo'yicha filter</span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Dan</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Gacha</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Tarix
        </h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Hali operatsiyalar yo'q</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                {tx.type === 'in' ? (
                  <ArrowDownCircle className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className={`font-semibold text-sm ${tx.type === 'in' ? 'text-green-600' : 'text-destructive'}`}>
                      {tx.type === 'in' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(tx.date).toLocaleDateString('uz-UZ')} {new Date(tx.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {tx.type === 'out' && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.personName} — {tx.reason}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{tx.operator}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Money Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pul qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Summa</Label>
              <Input
                type="number"
                placeholder="Summani kiriting..."
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Kim kiritmoqda (ism)</Label>
              <Input
                placeholder="Ismi..."
                value={personName}
                onChange={e => setPersonName(e.target.value)}
              />
            </div>
            <div>
              <Label>Nima uchun</Label>
              <Input
                placeholder="Masalan: kunlik tushum"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Bekor qilish</Button>
            <Button onClick={addMoney}>Qo'shish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pul olish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Summa</Label>
              <Input
                type="number"
                placeholder="Summani kiriting..."
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Nima uchun (sabab)</Label>
              <Input
                placeholder="Masalan: benzin uchun"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <div>
              <Label>Kim oldi (ism)</Label>
              <Input
                placeholder="Ismi..."
                value={personName}
                onChange={e => setPersonName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Bekor qilish</Button>
            <Button variant="destructive" onClick={withdrawMoney}>Olish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
