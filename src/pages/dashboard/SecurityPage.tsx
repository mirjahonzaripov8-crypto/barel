import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateCompany, getCompanies } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Unlock, Trash2, KeyRound, UserCog, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SecurityPage() {
  const { company, refreshCompany, user } = useAuth();
  const [op1, setOp1] = useState(company?.ops.op1 || '');
  const [op2, setOp2] = useState(company?.ops.op2 || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [pwInput, setPwInput] = useState('');

  // Credential change state
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  if (!company) return null;

  const checkPassword = () => {
    if (pwInput === company.securityPassword) {
      setAuthenticated(true);
      setPwInput('');
      toast.success("Tasdiqlandi!");
    } else {
      toast.error("Parol noto'g'ri!");
    }
  };

  if (!authenticated) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-6">XAVFSIZLIK</h1>
        <div className="max-w-md mx-auto">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <KeyRound className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Xavfsizlik paroli talab etiladi</h3>
            <p className="text-sm text-muted-foreground mb-4">Bu bo'limga kirish uchun xavfsizlik parolingizni kiriting</p>
            <div className="space-y-3">
              <Input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkPassword()}
                placeholder="Xavfsizlik paroli"
              />
              <Button onClick={checkPassword} className="w-full">KIRISH</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  const changeSecurityPassword = () => {
    const newPw = prompt("Yangi xavfsizlik parolini kiriting (kamida 4 ta belgi):");
    if (!newPw || newPw.length < 4) {
      toast.error("Parol kamida 4 ta belgidan iborat bo'lsin!"); return;
    }
    updateCompany(company.key, c => ({ ...c, securityPassword: newPw }));
    refreshCompany();
    toast.success("Xavfsizlik paroli o'zgartirildi!");
  };

  const startEditUser = (login: string) => {
    const u = company.users.find(u => u.login === login);
    if (!u) return;
    setEditingUser(login);
    setNewLogin(u.login);
    setNewPassword(u.password);
    setShowNewPw(false);
  };

  const saveUserCredentials = () => {
    if (!editingUser) return;
    if (!newLogin.trim() || newLogin.trim().length < 3) {
      toast.error("Login kamida 3 ta belgidan iborat bo'lsin!");
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 3) {
      toast.error("Parol kamida 3 ta belgidan iborat bo'lsin!");
      return;
    }
    // Check login uniqueness across all companies
    const allCompanies = getCompanies();
    for (const c of allCompanies) {
      for (const u of c.users) {
        if (u.login === newLogin.trim() && !(c.key === company.key && u.login === editingUser)) {
          toast.error("Bu login allaqachon band!");
          return;
        }
      }
    }

    updateCompany(company.key, c => ({
      ...c,
      users: c.users.map(u =>
        u.login === editingUser
          ? { ...u, login: newLogin.trim(), password: newPassword.trim() }
          : u
      ),
    }));
    refreshCompany();
    toast.success("Login va parol muvaffaqiyatli o'zgartirildi!");
    setEditingUser(null);
    setNewLogin('');
    setNewPassword('');
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

        {/* Right column */}
        <div className="space-y-6">
          {/* User credentials */}
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <UserCog className="h-4 w-4 text-primary" /> Foydalanuvchilar login/parol
            </h3>
            <div className="space-y-3">
              {company.users.map(u => (
                <div key={u.login} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.role} • {u.login}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditUser(u.login)}
                  >
                    O'zgartirish
                  </Button>
                </div>
              ))}
            </div>

            {editingUser && (
              <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  «{company.users.find(u => u.login === editingUser)?.name}» ma'lumotlarini o'zgartirish
                </h4>
                <div>
                  <Label className="text-xs">Yangi login</Label>
                  <Input value={newLogin} onChange={e => setNewLogin(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Yangi parol</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveUserCredentials} className="flex-1">SAQLASH</Button>
                  <Button variant="outline" onClick={() => setEditingUser(null)} className="flex-1">BEKOR QILISH</Button>
                </div>
              </div>
            )}
          </div>

          {/* Operators */}
          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <h3 className="font-semibold text-foreground mb-4">Operatorlar</h3>
            <div className="space-y-3">
              <div><Label className="text-xs">Operator 1</Label><Input value={op1} onChange={e => setOp1(e.target.value)} className="mt-1" /></div>
              <div><Label className="text-xs">Operator 2</Label><Input value={op2} onChange={e => setOp2(e.target.value)} className="mt-1" /></div>
              <Button onClick={saveOps} className="w-full">OPERATORLARNI SAQLASH</Button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4 md:p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Xavfsizlik paroli</h3>
            <p className="text-sm text-muted-foreground mb-3">Arxiv tahrirlash va xavfsizlik bo'limi uchun ishlatiladi</p>
            <Button variant="outline" onClick={changeSecurityPassword} className="w-full">PAROLNI O'ZGARTIRISH</Button>
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
