import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Vault, Package, Clipboard, Users, Truck, Wrench, Box,
  Calculator, FileText, ShoppingCart, Plus, Minus, Calendar,
  TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/helpers';

// ── Types ──
export interface FieldConfig {
  name: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ActionConfig {
  id: string;
  label: string;
  variant?: 'default' | 'outline' | 'destructive';
  direction?: 'in' | 'out' | 'neutral';
  fields: FieldConfig[];
}

export interface FeatureUIConfig {
  type: 'ledger' | 'crud' | 'tracker';
  title: string;
  description: string;
  icon: string;
  balanceField?: { label: string; unit: 'sum' | 'piece' | 'liter' | 'kg' };
  actions: ActionConfig[];
  historyDisplay?: {
    enabled?: boolean;
    dateFilter?: boolean;
    showStats?: boolean;
    columns?: { field: string; label: string }[];
  };
}

interface HistoryEntry {
  id: string;
  actionId: string;
  actionLabel: string;
  direction: 'in' | 'out' | 'neutral';
  amount?: number;
  fields: Record<string, string>;
  date: string;
  operator: string;
}

// ── Icon map ──
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  vault: Vault, package: Package, clipboard: Clipboard, users: Users,
  truck: Truck, wrench: Wrench, box: Box, calculator: Calculator,
  'file-text': FileText, 'shopping-cart': ShoppingCart,
};

// ── Storage helpers ──
function getStorageKey(companyKey: string, featureId: string) {
  return `barel_dynfeat_${companyKey}_${featureId}`;
}

function loadHistory(companyKey: string, featureId: string): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(companyKey, featureId)) || '[]');
  } catch { return []; }
}

function saveHistory(companyKey: string, featureId: string, data: HistoryEntry[]) {
  localStorage.setItem(getStorageKey(companyKey, featureId), JSON.stringify(data));
}

// ── Format helper ──
function formatValue(val: number, unit?: string) {
  if (unit === 'sum') return formatCurrency(val);
  if (unit === 'piece') return `${formatNumber(val)} dona`;
  if (unit === 'liter') return `${formatNumber(val)} litr`;
  if (unit === 'kg') return `${formatNumber(val)} kg`;
  return formatNumber(val);
}

// ── Main component ──
export default function DynamicFeatureRenderer({ config, featureId }: { config: FeatureUIConfig; featureId: string }) {
  const { company, user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (company) setHistory(loadHistory(company.key, featureId));
  }, [company?.key, featureId]);

  // Balance calculation for ledger type
  const balance = useMemo(() => {
    if (config.type !== 'ledger') return 0;
    return history.reduce((sum, h) => {
      const amt = h.amount || 0;
      return sum + (h.direction === 'in' ? amt : h.direction === 'out' ? -amt : 0);
    }, 0);
  }, [history, config.type]);

  // Filtered history
  const filtered = useMemo(() => {
    let list = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (dateFrom) list = list.filter(h => h.date >= dateFrom);
    if (dateTo) list = list.filter(h => h.date <= dateTo + 'T23:59:59');
    return list;
  }, [history, dateFrom, dateTo]);

  const totalIn = useMemo(() => filtered.filter(h => h.direction === 'in').reduce((s, h) => s + (h.amount || 0), 0), [filtered]);
  const totalOut = useMemo(() => filtered.filter(h => h.direction === 'out').reduce((s, h) => s + (h.amount || 0), 0), [filtered]);

  if (!company || !user) return null;

  const IconComp = ICON_MAP[config.icon] || Sparkles;

  function openAction(action: ActionConfig) {
    setFormData({});
    setActiveAction(action);
  }

  function submitAction() {
    if (!activeAction) return;

    // Validate required fields
    for (const field of activeAction.fields) {
      if (field.required && !formData[field.name]?.trim()) {
        toast.error(`${field.label} kiriting`);
        return;
      }
    }

    // Find amount field
    const amountField = activeAction.fields.find(f => f.type === 'number');
    const amount = amountField ? Number(formData[amountField.name]) : undefined;

    if (amountField && (!amount || amount <= 0)) {
      toast.error(`${amountField.label} to'g'ri kiriting`);
      return;
    }

    // Check balance for withdrawals
    if (activeAction.direction === 'out' && amount && amount > balance) {
      toast.error("Yetarli mablag'/miqdor yo'q");
      return;
    }

    const entry: HistoryEntry = {
      id: `dyn_${Date.now()}`,
      actionId: activeAction.id,
      actionLabel: activeAction.label,
      direction: activeAction.direction || 'neutral',
      amount,
      fields: { ...formData },
      date: new Date().toISOString(),
      operator: user!.name,
    };

    const updated = [...history, entry];
    setHistory(updated);
    saveHistory(company!.key, featureId, updated);
    setActiveAction(null);
    setFormData({});
    toast.success(`${activeAction.label} — muvaffaqiyatli`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <IconComp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>

      {/* Balance (ledger only) */}
      {config.type === 'ledger' && config.balanceField && (
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-1">{config.balanceField.label}:</p>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            {formatValue(balance, config.balanceField.unit)}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {config.actions.map(action => (
          <Button
            key={action.id}
            variant={action.variant || 'default'}
            onClick={() => openAction(action)}
            className="gap-2"
          >
            {action.direction === 'in' ? <Plus className="h-4 w-4" /> :
              action.direction === 'out' ? <Minus className="h-4 w-4" /> : null}
            {action.label}
          </Button>
        ))}
      </div>

      {/* Stats (ledger only) */}
      {config.type === 'ledger' && config.historyDisplay?.showStats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Kirdi</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              {formatValue(totalIn, config.balanceField?.unit)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Ketdi</span>
            </div>
            <p className="text-xl font-bold text-destructive">
              {formatValue(totalOut, config.balanceField?.unit)}
            </p>
          </div>
        </div>
      )}

      {/* Date filter */}
      {config.historyDisplay?.dateFilter && (
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
      )}

      {/* History */}
      {config.historyDisplay?.enabled !== false && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clipboard className="h-4 w-4 text-primary" /> Tarix
          </h2>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Hali ma'lumotlar yo'q</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  {entry.direction === 'in' ? (
                    <ArrowDownCircle className="h-5 w-5 text-green-600 shrink-0" />
                  ) : entry.direction === 'out' ? (
                    <ArrowUpCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">{entry.actionLabel}</span>
                        {entry.amount != null && (
                          <p className={`font-semibold text-sm ${
                            entry.direction === 'in' ? 'text-green-600' :
                            entry.direction === 'out' ? 'text-destructive' : 'text-foreground'
                          }`}>
                            {entry.direction === 'in' ? '+' : entry.direction === 'out' ? '-' : ''}
                            {formatValue(entry.amount, config.balanceField?.unit)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(entry.date).toLocaleDateString('uz-UZ')}{' '}
                        {new Date(entry.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {/* Show non-amount fields */}
                    {Object.entries(entry.fields)
                      .filter(([key]) => {
                        const fieldConf = config.actions
                          .find(a => a.id === entry.actionId)?.fields
                          .find(f => f.name === key);
                        return fieldConf && fieldConf.type !== 'number';
                      })
                      .map(([key, val]) => {
                        const fieldConf = config.actions
                          .find(a => a.id === entry.actionId)?.fields
                          .find(f => f.name === key);
                        return (
                          <p key={key} className="text-xs text-muted-foreground">
                            {fieldConf?.label}: {val}
                          </p>
                        );
                      })}
                    <p className="text-xs text-muted-foreground">{entry.operator}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!activeAction} onOpenChange={(open) => { if (!open) setActiveAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAction?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeAction?.fields.map(field => (
              <div key={field.name}>
                <Label>{field.label}{field.required ? ' *' : ''}</Label>
                {field.type === 'select' && field.options ? (
                  <Select
                    value={formData[field.name] || ''}
                    onValueChange={val => setFormData(prev => ({ ...prev, [field.name]: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder || `${field.label} tanlang`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    placeholder={field.placeholder || `${field.label}...`}
                    value={formData[field.name] || ''}
                    onChange={e => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Bekor qilish</Button>
            <Button
              variant={activeAction?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={submitAction}
            >
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
