import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bell, Plus, Check, Clock, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface Reminder {
  id: string;
  text: string;
  date?: string; // ISO date, optional
  time?: string; // HH:mm, optional
  status: 'active' | 'done' | 'cancelled';
  snoozedUntilDate?: string;
  snoozedUntilTime?: string;
  createdAt: string;
}

function getRemindersKey(companyKey: string) {
  return `barel_reminders_${companyKey}`;
}

function loadReminders(companyKey: string): Reminder[] {
  try {
    return JSON.parse(localStorage.getItem(getRemindersKey(companyKey)) || '[]');
  } catch { return []; }
}

function saveReminders(companyKey: string, reminders: Reminder[]) {
  localStorage.setItem(getRemindersKey(companyKey), JSON.stringify(reminders));
}

export default function RemindersPage() {
  const { company, user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeId, setSnoozeId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [notifications, setNotifications] = useState<Reminder[]>([]);

  useEffect(() => {
    if (company) setReminders(loadReminders(company.key));
  }, [company?.key]);

  // Check for due reminders every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = new Date();
      const active = reminders.filter(r => r.status === 'active');
      const due: Reminder[] = [];

      for (const r of active) {
        // If no date/time set, always show notification
        if (!r.date && !r.time) {
          due.push(r);
          continue;
        }

        // Check snoozed
        if (r.snoozedUntilDate || r.snoozedUntilTime) {
          const sDate = r.snoozedUntilDate || '';
          const sTime = r.snoozedUntilTime || '00:00';
          const snoozedUntil = new Date(`${sDate}T${sTime}:00`);
          if (now >= snoozedUntil) {
            due.push(r);
          }
          continue;
        }

        // Check if due
        const rDate = r.date || '';
        const rTime = r.time || '00:00';
        if (rDate) {
          const dueAt = new Date(`${rDate}T${rTime}:00`);
          if (now >= dueAt) {
            due.push(r);
          }
        }
      }
      setNotifications(due);
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [reminders]);

  const save = useCallback((updated: Reminder[]) => {
    if (!company) return;
    setReminders(updated);
    saveReminders(company.key, updated);
  }, [company]);

  if (!company || !user) return null;

  function addReminder() {
    if (!text.trim()) { toast.error("Eslatma matnini kiriting"); return; }
    const newR: Reminder = {
      id: `rem_${Date.now()}`,
      text: text.trim(),
      date: date || undefined,
      time: time || undefined,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    save([...reminders, newR]);
    setText(''); setDate(''); setTime('');
    setAddOpen(false);
    toast.success("Eslatma qo'shildi");
  }

  function markDone(id: string) {
    save(reminders.map(r => r.id === id ? { ...r, status: 'done' as const } : r));
    toast.success("Bajarildi ✓");
  }

  function cancelReminder(id: string) {
    save(reminders.map(r => r.id === id ? { ...r, status: 'cancelled' as const } : r));
    toast("Eslatma bekor qilindi");
  }

  function openSnooze(id: string) {
    setSnoozeId(id);
    setSnoozeDate('');
    setSnoozeTime('');
    setSnoozeOpen(true);
  }

  function confirmSnooze() {
    if (!snoozeId) return;
    if (!snoozeDate && !snoozeTime) { toast.error("Sana yoki vaqt kiriting"); return; }
    save(reminders.map(r => r.id === snoozeId ? {
      ...r,
      snoozedUntilDate: snoozeDate || r.date,
      snoozedUntilTime: snoozeTime || r.time,
    } : r));
    setSnoozeOpen(false);
    setSnoozeId(null);
    toast.success("Keyinga qoldirildi");
  }

  const activeReminders = reminders.filter(r => r.status === 'active');
  const doneReminders = reminders.filter(r => r.status === 'done' || r.status === 'cancelled');

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
              <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{n.text}</p>
                {(n.date || n.time) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {n.date && new Date(n.date).toLocaleDateString('uz-UZ')} {n.time}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => markDone(n.id)} className="gap-1 text-xs h-8">
                  <Check className="h-3 w-3" /> Bajarildi
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSnooze(n.id)} className="gap-1 text-xs h-8">
                  <Clock className="h-3 w-3" /> Keyinga
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Eslatmalar</h1>
            <p className="text-muted-foreground text-sm">Muhim ishlarni eslatib turish</p>
          </div>
        </div>
        <Button onClick={() => { setText(''); setDate(''); setTime(''); setAddOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Yangi eslatma
        </Button>
      </div>

      {/* Active reminders */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-primary" /> Faol eslatmalar ({activeReminders.length})
        </h2>
        {activeReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Hali eslatmalar yo'q</p>
        ) : (
          <div className="space-y-2">
            {activeReminders.map(r => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <Bell className="h-4 w-4 text-primary shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.text}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                    {r.date && <span>📅 {new Date(r.date).toLocaleDateString('uz-UZ')}</span>}
                    {r.time && <span>🕐 {r.time}</span>}
                    {!r.date && !r.time && <span>⏰ Doimiy</span>}
                    {r.snoozedUntilDate && <span className="text-warning">↻ {new Date(r.snoozedUntilDate).toLocaleDateString('uz-UZ')} {r.snoozedUntilTime}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => markDone(r.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => openSnooze(r.id)}>
                    <Clock className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => cancelReminder(r.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Done reminders */}
      {doneReminders.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Check className="h-4 w-4" /> Tugallangan ({doneReminders.length})
          </h2>
          <div className="space-y-2">
            {doneReminders.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 opacity-60">
                <Check className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground line-through">{r.text}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.status === 'cancelled' ? 'Bekor' : 'Bajarildi'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi eslatma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Eslatma matni *</Label>
              <Textarea
                placeholder="Masalan: Yetkazib beruvchini chaqirish"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sana (ixtiyoriy)</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Soat (ixtiyoriy)</Label>
                <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Sana va soat kiritilmasa, eslatma doimiy ravishda ko'rinib turadi</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Bekor</Button>
            <Button onClick={addReminder}>Qo'shish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyinga qoldirish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Yangi sana</Label>
              <Input type="date" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} />
            </div>
            <div>
              <Label>Yangi soat</Label>
              <Input type="time" value={snoozeTime} onChange={e => setSnoozeTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeOpen(false)}>Bekor</Button>
            <Button onClick={confirmSnooze}>Tasdiqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
