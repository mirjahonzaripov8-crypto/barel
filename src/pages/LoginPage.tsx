import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, ArrowLeft, Eye, EyeOff, ScanFace, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  isWebAuthnSupported,
  registerBiometric,
  verifyBiometric,
  hasBiometricRegistered,
  getLoginKeyForCredentials,
  isInIframe,
} from '@/lib/biometric';
import { getCompanyByKey, setCurrentStation } from '@/lib/store';
import StationPicker from '@/components/StationPicker';

type BiometricStep = 'none' | 'verify' | 'register';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [biometricStep, setBiometricStep] = useState<BiometricStep>('none');
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [stationPickerData, setStationPickerData] = useState<{ stations: string[]; result: any } | null>(null);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  const proceedAfterLogin = (result: any) => {
    if (result.isSuperAdmin) {
      toast.success('Muvaffaqiyatli kirdingiz!');
      navigate('/admin');
      return;
    }
    // Check if company has multiple stations
    if (result.companyKey) {
      const company = getCompanyByKey(result.companyKey);
      if (company && company.stations.length > 1) {
        setStationPickerData({ stations: company.stations, result });
        return;
      }
    }
    setCurrentStation(0);
    toast.success('Muvaffaqiyatli kirdingiz!');
    navigate('/dashboard');
  };

  const handleStationSelected = (index: number) => {
    setCurrentStation(index);
    toast.success('Muvaffaqiyatli kirdingiz!');
    navigate('/dashboard');
  };

  // Station picker screen
  if (stationPickerData) {
    return (
      <StationPicker
        stations={stationPickerData.stations}
        onSelect={handleStationSelected}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password.trim()) {
      toast.error('Login va parolni kiriting!');
      return;
    }

    const result = doLogin(login.trim(), password.trim());
    if (!result.success) {
      toast.error(result.error || 'Xatolik!');
      return;
    }

    // Check if this is a special login requiring biometric
    const loginKey = getLoginKeyForCredentials(login.trim());
    if (loginKey && isWebAuthnSupported() && !isInIframe()) {
      setPendingResult(result);
      if (hasBiometricRegistered(loginKey)) {
        setBiometricStep('verify');
      } else {
        setBiometricStep('register');
      }
      return;
    }

    // Normal login - no biometric needed
    proceedAfterLogin(result);
  };

  const handleBiometricVerify = async () => {
    const loginKey = getLoginKeyForCredentials(login.trim());
    if (!loginKey) return;

    setBiometricLoading(true);
    try {
      const verified = await verifyBiometric(loginKey);
      if (verified) {
        proceedAfterLogin(pendingResult);
      } else {
        toast.error("Yuzni tanib bo'lmadi! Kirish rad etildi.");
        setBiometricStep('none');
        setPendingResult(null);
      }
    } catch {
      toast.error("Biometrik tekshirish xatosi!");
      setBiometricStep('none');
      setPendingResult(null);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricRegister = async () => {
    const loginKey = getLoginKeyForCredentials(login.trim());
    if (!loginKey) return;

    setBiometricLoading(true);
    try {
      const registered = await registerBiometric(loginKey);
      if (registered) {
        toast.success("Face ID / biometrik muvaffaqiyatli ro'yxatdan o'tdi!");
        proceedAfterLogin(pendingResult);
      } else {
        toast.error("Biometrik ro'yxatdan o'tkazib bo'lmadi.");
        // Still allow login this first time
        proceedAfterLogin(pendingResult);
      }
    } catch {
      toast.error("Biometrik xatosi. Keyingi safar sozlanadi.");
      proceedAfterLogin(pendingResult);
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricSkipCancel = () => {
    toast.error("Kirish bekor qilindi.");
    setBiometricStep('none');
    setPendingResult(null);
  };

  // Biometric verification screen
  if (biometricStep === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
        <div className="animate-scale-in w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <ScanFace className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Face ID talab qilinadi</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Davom etish uchun yuzingizni tasdiqlang
            </p>
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base"
                onClick={handleBiometricVerify}
                disabled={biometricLoading}
              >
                <ScanFace className="h-5 w-5 mr-2" />
                {biometricLoading ? 'Tekshirilmoqda...' : 'Yuzni tasdiqlash'}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={handleBiometricSkipCancel}
                disabled={biometricLoading}
              >
                Bekor qilish
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Biometric registration screen (first time)
  if (biometricStep === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
        <div className="animate-scale-in w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Face ID sozlash</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Xavfsizlik uchun Face ID / biometrik ro'yxatdan o'tkaziladi.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Keyingi kirishda yuzingiz talab qilinadi.
            </p>
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base"
                onClick={handleBiometricRegister}
                disabled={biometricLoading}
              >
                <ScanFace className="h-5 w-5 mr-2" />
                {biometricLoading ? 'Sozlanmoqda...' : "Face ID ni sozlash"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-destructive"
                onClick={handleBiometricSkipCancel}
                disabled={biometricLoading}
              >
                Bekor qilish
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="animate-scale-in w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <Zap className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">BAREL<span className="text-primary">.uz</span></span>
            </div>
            <p className="text-muted-foreground text-sm">Tizimga kirish</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="login">Login</Label>
              <Input id="login" value={login} onChange={e => setLogin(e.target.value)} placeholder="Loginingizni kiriting" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Parol</Label>
              <div className="relative mt-1">
                <Input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Parolni kiriting" className="pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-base shadow-button hover:-translate-y-0.5 transition-transform">KIRISH</Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Hisobingiz yo'qmi?{' '}
              <button onClick={() => navigate('/register')} className="text-primary font-medium hover:underline">Ro'yxatdan o'tish</button>
            </p>
            <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Orqaga
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">Demo: login <b>demo</b> / parol <b>demo</b></p>
          </div>
        </div>
      </div>
    </div>
  );
}
