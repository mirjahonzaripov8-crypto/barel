import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, ArrowLeft, ArrowRight, Check, ShieldCheck, Fuel, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { registerCompany, getCompanies, type FuelType } from '@/lib/store';
import { PLANS, calculatePlanPrice, type PlanKey } from '@/lib/helpers';

const defaultFuelList: (FuelType & { selected?: boolean })[] = [
  { name: 'Propan', unit: 'L', meterCount: 1 },
  { name: 'AI-91', unit: 'L', meterCount: 1 },
  { name: 'AI-92', unit: 'L', meterCount: 1 },
  { name: 'AI-95', unit: 'L', meterCount: 1 },
  { name: 'Dizel', unit: 'L', meterCount: 1 },
  { name: 'Metan', unit: 'm³', meterCount: 1 },
];

type StationFuelConfig = (FuelType & { selected: boolean })[];

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', companyName: '', phone: '',
    stations: [''],
    // Per-station fuel configs - initialized with one station
    stationFuels: [defaultFuelList.map(f => ({ ...f, selected: true, meterCount: 1 }))] as StationFuelConfig[],
    plan: (searchParams.get('plan') as PlanKey) || 'STANDART' as PlanKey,
    promocode: '', login: '', password: '',
    securityPassword: '',
    activeStationTab: 0,
  });

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  // Sync stationFuels array when stations change
  const syncStationFuels = (stations: string[]) => {
    const current = [...form.stationFuels];
    while (current.length < stations.length) {
      current.push(defaultFuelList.map(f => ({ ...f, selected: true, meterCount: 1 })));
    }
    // trim extras
    const synced = current.slice(0, stations.length);
    return synced;
  };

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
    if (step === 3) {
      // Sync station fuels when moving from step 3 to 4
      const synced = syncStationFuels(form.stations.filter(s => s.trim()));
      update('stationFuels', synced);
      update('activeStationTab', 0);
    }
    if (step === 4) {
      // Validate each station has at least one fuel selected
      for (let i = 0; i < form.stationFuels.length; i++) {
        if (form.stationFuels[i].filter(f => f.selected).length === 0) {
          toast.error(`"${form.stations[i]}" uchun kamida bitta mahsulot tanlang!`);
          update('activeStationTab', i);
          return;
        }
      }
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

    const validStations = form.stations.filter(s => s.trim());
    const stationConfigs = form.stationFuels.slice(0, validStations.length).map(sf => ({
      fuelTypes: sf.filter(f => f.selected).map(({ name, unit, meterCount }) => ({ name, unit, meterCount: meterCount || 1 })),
    }));

    const result = registerCompany({
      firstName: form.firstName, lastName: form.lastName,
      companyName: form.companyName, phone: form.phone,
      stations: validStations,
      stationConfigs,
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

  const addStation = () => {
    const newStations = [...form.stations, ''];
    update('stations', newStations);
    const newFuels = [...form.stationFuels, defaultFuelList.map(f => ({ ...f, selected: true, meterCount: 1 }))];
    update('stationFuels', newFuels);
  };
  const updateStation = (i: number, v: string) => {
    const s = [...form.stations]; s[i] = v; update('stations', s);
  };
  const removeStation = (i: number) => {
    if (form.stations.length <= 1) return;
    update('stations', form.stations.filter((_, idx) => idx !== i));
    update('stationFuels', form.stationFuels.filter((_, idx) => idx !== i));
    if (form.activeStationTab >= form.stations.length - 1) {
      update('activeStationTab', Math.max(0, form.stations.length - 2));
    }
  };

  const toggleFuel = (stationIdx: number, fuelIdx: number) => {
    const sf = [...form.stationFuels];
    sf[stationIdx] = [...sf[stationIdx]];
    sf[stationIdx][fuelIdx] = { ...sf[stationIdx][fuelIdx], selected: !sf[stationIdx][fuelIdx].selected };
    update('stationFuels', sf);
  };

  const updateMeterCount = (stationIdx: number, fuelIdx: number, count: number) => {
    const sf = [...form.stationFuels];
    sf[stationIdx] = [...sf[stationIdx]];
    sf[stationIdx][fuelIdx] = { ...sf[stationIdx][fuelIdx], meterCount: Math.max(1, Math.min(20, count)) };
    update('stationFuels', sf);
  };

  const validStationCount = form.stations.filter(s => s.trim()).length;
  const pricing = calculatePlanPrice(form.plan, validStationCount);

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

          {/* Step 4: Per-station fuel types + meter counts */}
          {step === 4 && (
            <div className="space-y-3 animate-fade-in">
              <Label>Har bir zapravka uchun mahsulotlar va hisoblagichlar</Label>

              {/* Station tabs */}
              {form.stations.filter(s => s.trim()).length > 1 && (
                <div className="flex gap-1 flex-wrap">
                  {form.stations.filter(s => s.trim()).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => update('activeStationTab', i)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        form.activeStationTab === i
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Fuel className="h-3 w-3 inline mr-1" />
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Current station config */}
              {form.stationFuels[form.activeStationTab] && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{form.stations.filter(s => s.trim())[form.activeStationTab]}</span> — mahsulotlarni tanlang va hisoblagichlar sonini belgilang
                  </p>
                  {form.stationFuels[form.activeStationTab].map((f, fi) => (
                    <div key={f.name} className={`w-full rounded-lg border transition-colors ${f.selected ? 'border-primary bg-secondary' : 'border-border'}`}>
                      <button onClick={() => toggleFuel(form.activeStationTab, fi)} className="w-full flex items-center gap-3 p-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${f.selected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                          {f.selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="font-medium text-foreground">{f.name}</span>
                        <span className="text-muted-foreground text-sm ml-auto">({f.unit})</span>
                      </button>
                      {f.selected && (
                        <div className="px-3 pb-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Hisoblagichlar soni:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={f.meterCount || 1}
                            onChange={e => updateMeterCount(form.activeStationTab, fi, Number(e.target.value))}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Plan selection with multi-station pricing */}
          {step === 5 && (
            <div className="space-y-3 animate-fade-in">
              <Label>Tarifni tanlang</Label>

              {/* Discount banner */}
              {validStationCount >= 2 && validStationCount <= 5 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30">
                  <Percent className="h-4 w-4 text-success shrink-0" />
                  <p className="text-xs text-success font-medium">
                    {validStationCount} ta zapravka — <span className="font-bold">20% chegirma</span> qo'llanildi!
                  </p>
                </div>
              )}
              {validStationCount > 5 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <Percent className="h-4 w-4 text-warning shrink-0" />
                  <p className="text-xs text-warning font-medium">
                    5 tagacha zapravkaga 20% chegirma, qolgan {validStationCount - 5} tasiga to'liq narx
                  </p>
                </div>
              )}

              {(Object.keys(PLANS) as PlanKey[]).map(key => {
                const p = calculatePlanPrice(key, validStationCount);
                const hasDiscount = p.discount > 0;
                return (
                  <button key={key} onClick={() => update('plan', key)} className={`w-full text-left p-4 rounded-lg border transition-all ${form.plan === key ? 'border-primary bg-secondary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">{PLANS[key].name}</span>
                      <div className="text-right">
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through mr-2">
                            {p.originalTotal.toLocaleString()} so'm
                          </span>
                        )}
                        <span className="font-bold text-primary">{p.total.toLocaleString()} so'm/oy</span>
                      </div>
                    </div>
                    {validStationCount > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {validStationCount} ta zapravka × {PLANS[key].price.toLocaleString()} so'm
                        {hasDiscount && <span className="text-success font-semibold"> − {p.discount.toLocaleString()} so'm chegirma</span>}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{PLANS[key].features.join(' • ')}</p>
                  </button>
                );
              })}
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