import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password.trim()) {
      toast.error('Login va parolni kiriting!');
      return;
    }
    const result = doLogin(login.trim(), password.trim());
    if (result.success) {
      toast.success('Muvaffaqiyatli kirdingiz!');
      if (result.isSuperAdmin) {
        navigate('/admin');
      } else if (result.isLooker) {
        navigate('/looker');
      } else {
        navigate('/dashboard');
      }
    } else {
      toast.error(result.error || 'Xatolik!');
    }
  };

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
