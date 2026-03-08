import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, addLog } from '@/lib/store';
import { formatDateTime, getMonthAgoStr, getTodayStr, isInRange } from '@/lib/helpers';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Users, Plus, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkersPage() {
  const { company, user, refreshCompany } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'BOSS' | 'OPERATOR'>('OPERATOR');
  const [logFrom, setLogFrom] = useState(getMonthAgoStr());
  const [logTo, setLogTo] = useState(getTodayStr());
  const [detailLog, setDetailLog] = useState<any>(null);

  if (!company) return null;

  const addWorker = () => {
    if (!login.trim() || !password.trim() || !name.trim()) {
      toast.error("Barcha maydonlarni to'ldiring!"); return;
    }
    if (company.users.some(u => u.login === login)) {
      toast.error("Bu login band!"); return;
    }
    updateCompany(company.key, c => ({
      ...c,
      users: [...c.users, { login, password, name, role }],
    }));
    addLog(company.key, user?.login || '', 'Ishchi', `${name} (${login}) qo'shildi`);
    refreshCompany();
    setLogin(''); setPassword(''); setName('');
    toast.success("Ishchi qo'shildi!");
  };

  const deleteWorker = (workerLogin: string) => {
    if (workerLogin === user?.login) { toast.error("O'zingizni o'chira olmaysiz!"); return; }
    updateCompany(company.key, c => ({
      ...c,
      users: c.users.filter(u => u.login !== workerLogin),
    }));
    addLog(company.key, user?.login || '', 'Ishchi', `${workerLogin} o'chirildi`);
    refreshCompany();
    toast.success("Ishchi o'chirildi!");
  };

  const logs = company.logs.filter(l => isInRange(l.timestamp, logFrom, logTo));

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">ISHCHILAR VA NAZORAT</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Add worker */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Yangi ishchi qo'shish</h3>
          <div className="space-y-3 mb-4">
            <div><Label className="text-xs">Login</Label><Input value={login} onChange={e => setLogin(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Parol</Label><Input value={password} onChange={e => setPassword(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">Ism</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
            {user?.role === 'BOSS' && (
              <div>
                <Label className="text-xs">Rol</Label>
                <select value={role} onChange={e => setRole(e.target.value as any)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="BOSS">BOSS</option>
                  <option value="WORKER">Ishchi</option>
                </select>
              </div>
            )}
            <Button onClick={addWorker} className="w-full">QO'SHISH</Button>
          </div>

          <h4 className="font-semibold text-foreground mb-3 mt-6">Mavjud ishchilar</h4>
          <div className="space-y-2">
            {company.users.map(w => (
              <div key={w.login} className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.login} · {w.role}</p>
                </div>
                {w.login !== user?.login && (
                  <Button variant="ghost" size="sm" onClick={() => deleteWorker(w.login)} className="text-destructive h-7"><Trash2 className="h-3 w-3" /></Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Activity logs */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h3 className="font-semibold text-foreground mb-4">Faollik tarixi</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            <div><Label className="text-xs">Dan</Label><Input type="date" value={logFrom} onChange={e => setLogFrom(e.target.value)} className="mt-1 w-36" /></div>
            <div><Label className="text-xs">Gacha</Label><Input type="date" value={logTo} onChange={e => setLogTo(e.target.value)} className="mt-1 w-36" /></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Vaqt</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Kim</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Harakat</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs">Amal</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">Faollik topilmadi</td></tr>
                ) : logs.slice().reverse().slice(0, 50).map((l, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2 px-2 text-xs">{formatDateTime(l.timestamp)}</td>
                    <td className="py-2 px-2">{l.user}</td>
                    <td className="py-2 px-2">{l.action}</td>
                    <td className="py-2 px-2"><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setDetailLog(l)}><Eye className="h-3 w-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail overlay */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4" onClick={() => setDetailLog(null)}>
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-foreground mb-3">Batafsil</h3>
            <p className="text-sm text-muted-foreground mb-1"><b>Vaqt:</b> {formatDateTime(detailLog.timestamp)}</p>
            <p className="text-sm text-muted-foreground mb-1"><b>Kim:</b> {detailLog.user}</p>
            <p className="text-sm text-muted-foreground mb-1"><b>Harakat:</b> {detailLog.action}</p>
            <p className="text-sm text-foreground mt-2">{detailLog.detail}</p>
            <Button variant="outline" className="w-full mt-4" onClick={() => setDetailLog(null)}>YOPISH</Button>
          </div>
        </div>
      )}
    </div>
  );
}
