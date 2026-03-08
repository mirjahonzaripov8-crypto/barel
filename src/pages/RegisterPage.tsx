import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { registerCompany, type FuelType } from '@/lib/store';
import { PLANS, type PlanKey } from '@/lib/helpers';

const defaultFuels: (FuelType & { selected?: boolean })[] = [
  { name: 'Propan', unit: 'L', meterCount: 1 },
  { name: 'AI-91', unit: 'L', meterCount: 1 },
  { name: 'AI-92', unit: 'L', meterCount: 1 },
  { name: 'AI-95', unit: 'L', meterCount: 1 },
  { name: 'Dizel', unit: 'L', meterCount: 1 },
  { name: 'Metan', unit: 'm³', meterCount: 1 },
];

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', companyName: '', phone: '',
    stations: [''],
    fuelTypes: defaultFuels.map(f => ({ ...f, selected: true, meterCount: f.meterCount || 1 })),
    plan: (searchParams.get('plan') as PlanKey) || 'STANDART' as PlanKey,
    promocode: '', login: '', password: '',
    securityPassword: '',
  });

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const next = () => {
    if (step === 1 && (!form.firstName.trim() || !form.lastName.trim())) {
      toast.error("Ism va familyani kiriting!"); return;
    }
    if (step === 2 && (!form.companyName.trim() || !form.phone.trim())) {
      toast.error("MCHJ nomi va telefonni kiriting!"); return;
    }
    if (step === 3 && form.stations.filter(s => s.trim()).length === 0) {
      toast.error("Kamida bitta zapravka kiriting!"); return;
    }
    if (step === 4 && form.fuelTypes.filter(f => f.selected).length === 0) {
      toast.error("Kamida bitta yoqilg'i turini tanlang!"); return;
    }
    setStep(s => Math.min(s + 1, 7));
  };

  const back = () => setStep(s => Math.max(s - 1, 1));

  const finish = () => {
    if (!form.login.trim() || !form.password.trim()) {
      toast.error("Login va parolni kiriting!"); return;
    }
    if (form.password.length < 4) {
      toast.error("Parol kamida 4 ta belgidan iborat bo'lsin!"); return;
    }
    if (!form.securityPassword.trim() || form.securityPassword.length < 4) {
      toast.error("Xavfsizlik paroli kamida 4 ta belgidan iborat bo'lsin!"); return;
    }
    const result = registerCompany({
      firstName: form.firstName, lastName: form.lastName,
      companyName: form.companyName, phone: form.phone,
      stations: form.stations.filter(s => s.trim()),
      fuelTypes: form.fuelTypes.filter(f => f.selected).map(({ name, unit }) => ({ name, unit })),
      plan: form.plan, login: form.login, password: form.password,
      promocode: form.promocode || undefined,
      securityPassword: form.securityPassword,
    });
    if (result.success) {
      toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz! 7 kunlik bepul sinov boshlandi.");
      navigate('/login');
    } else {
      toast.error(result.error || 'Xatolik!');
    }
  };

  const addStation = () => update('stations', [...form.stations, '']);
  const updateStation = (i: number, v: string) => {
    const s = [...form.stations]; s[i] = v; update('stations', s);
  };
  const removeStation = (i: number) => {
    if (form.stations.length <= 1) return;
    update('stations', form.stations.filter((_, idx) => idx !== i));
  };
  const toggleFuel = (i: number) => {
    const f = [...form.fuelTypes]; f[i] = { ...f[i], selected: !f[i].selected }; update('fuelTypes', f);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="animate-scale-in w-full max-w-lg">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <Zap className="h-7 w-7 text-primary" />
              <span className="text-xl font-bold text-foreground">BAREL<span className="text-primary">.uz</span></span>
            </div>
            <p className="text-muted-foreground text-sm">Ro'yxatdan o'tish — Qadam {step}/7</p>
            <div className="flex gap-1 mt-3 justify-center">
              {[1,2,3,4,5,6,7].map(s => (
                <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div><Label>Ism</Label><Input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Ismingiz" className="mt-1" /></div>
              <div><Label>Familya</Label><Input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Familyangiz" className="mt-1" /></div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div><Label>Korxona nomi (MCHJ)</Label><Input value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Masalan: BUXORO YOQILG'I MCHJ" className="mt-1" /></div>
              <div><Label>Telefon raqam</Label><Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+998 XX XXX XX XX" className="mt-1" /></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <Label>Zapravka nomlari</Label>
              {form.stations.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s} onChange={e => updateStation(i, e.target.value)} placeholder={`Zapravka ${i+1} nomi`} />
                  {form.stations.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeStation(i)} className="text-destructive shrink-0">✕</Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addStation}>+ Zapravka qo'shish</Button>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3 animate-fade-in">
              <Label>Yoqilg'i turlari</Label>
              {form.fuelTypes.map((f, i) => (
                <button key={f.name} onClick={() => toggleFuel(i)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${f.selected ? 'border-primary bg-secondary' : 'border-border'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${f.selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                    {f.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="font-medium text-foreground">{f.name}</span>
                  <span className="text-muted-foreground text-sm ml-auto">({f.unit})</span>
                </button>
              ))}
            </div>
          )}
          {step === 5 && (
            <div className="space-y-3 animate-fade-in">
              <Label>Tarifni tanlang</Label>
              {(Object.keys(PLANS) as PlanKey[]).map(key => (
                <button key={key} onClick={() => update('plan', key)} className={`w-full text-left p-4 rounded-lg border transition-all ${form.plan === key ? 'border-primary bg-secondary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">{PLANS[key].name}</span>
                    <span className="font-bold text-primary">{PLANS[key].price.toLocaleString()} so'm/oy</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{PLANS[key].features.join(' • ')}</p>
                </button>
              ))}
              <div className="mt-4">
                <Label>Promokod (ixtiyoriy)</Label>
                <Input value={form.promocode} onChange={e => update('promocode', e.target.value)} placeholder="Do'stingizning promokodi" className="mt-1" />
              </div>
            </div>
          )}
          {step === 6 && (
            <div className="space-y-4 animate-fade-in">
              <div><Label>Login</Label><Input value={form.login} onChange={e => update('login', e.target.value)} placeholder="Loginingizni yarating" className="mt-1" /></div>
              <div><Label>Parol</Label><Input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Kamida 4 ta belgi" className="mt-1" /></div>
            </div>
          )}
          {step === 7 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg border border-border mb-2">
                <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-foreground text-sm">Xavfsizlik paroli</p>
                  <p className="text-xs text-muted-foreground">Bu parol arxiv tahrirlash va xavfsizlik sozlamalarini ochish uchun ishlatiladi</p>
                </div>
              </div>
              <div>
                <Label>Xavfsizlik paroli</Label>
                <Input type="password" value={form.securityPassword} onChange={e => update('securityPassword', e.target.value)} placeholder="Maxsus xavfsizlik paroli (kamida 4 ta belgi)" className="mt-1" />
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <Button variant="outline" onClick={back}><ArrowLeft className="h-4 w-4 mr-1" /> Orqaga</Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4 mr-1" /> Orqaga</Button>
            )}
            {step < 7 ? (
              <Button onClick={next}>Keyingi <ArrowRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={finish} className="shadow-button hover:-translate-y-0.5 transition-transform">RO'YXATDAN O'TISH</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
