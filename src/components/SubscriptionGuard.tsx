import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { checkSubscription, getAdminCard, addPayment, type Payment } from '@/lib/store';
import { formatCurrency } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import { CreditCard, AlertTriangle, Upload, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { company, user, logout } = useAuth();
  const [reminderOpen, setReminderOpen] = useState(false);
  const [hardLocked, setHardLocked] = useState(false);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const card = getAdminCard();

  const getExpiryInfo = useCallback(() => {
    if (!company) return { locked: false, warning: false, daysPastExpiry: 0 };
    const sub = checkSubscription(company);
    if (!sub.locked) return { ...sub, daysPastExpiry: 0 };

    // Calculate days past expiry
    let expiryDate: Date | null = null;
    if (company.subscription.status === 'trial') {
      expiryDate = new Date(company.subscription.trial_end_date);
    } else if (company.subscription.active_until) {
      expiryDate = new Date(company.subscription.active_until);
    }

    const daysPast = expiryDate
      ? Math.floor((Date.now() - expiryDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return { ...sub, daysPastExpiry: daysPast };
  }, [company]);

  // 10-minute reminder interval
  useEffect(() => {
    if (!company) return;
    const info = getExpiryInfo();
    if (!info.locked) return;

    // Show immediately
    if (info.daysPastExpiry >= 2) {
      setHardLocked(true);
    } else {
      setReminderOpen(true);
    }

    const interval = setInterval(() => {
      const currentInfo = getExpiryInfo();
      if (currentInfo.locked && currentInfo.daysPastExpiry < 2) {
        setReminderOpen(true);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [company, getExpiryInfo]);

  // Telegram reminder every 5 hours for boss
  useEffect(() => {
    if (!company || !user || user.role !== 'BOSS') return;
    const info = getExpiryInfo();
    if (!info.locked) return;

    const sendTelegramReminder = async () => {
      try {
        const { data: settings } = await supabase
          .from('telegram_settings')
          .select('chat_id, enabled')
          .eq('company_key', company.key)
          .eq('enabled', true)
          .maybeSingle();

        if (!settings?.chat_id) return;

        const message = `⚠️ <b>OBUNA MUDDATI TUGAGAN!</b>\n\n` +
          `🏢 ${company.name}\n\n` +
          `💳 <b>To'lov uchun karta:</b>\n` +
          `${card.cardNumber || 'Belgilanmagan'}\n` +
          `${card.cardHolder || ''}\n\n` +
          `📱 Ilovaga kirib chek rasmini yuklang.\n` +
          `⏰ 2 kun ichida to'lash kerak, aks holda tizim to'liq bloklanadi.\n\n` +
          `🤖 BAREL.uz`;

        await supabase.functions.invoke('telegram-bot', {
          body: { action: 'send', chat_id: settings.chat_id, message },
        });
      } catch (e) {
        console.error('Telegram reminder failed:', e);
      }
    };

    sendTelegramReminder();
    const interval = setInterval(sendTelegramReminder, 5 * 60 * 60 * 1000); // 5 hours

    return () => clearInterval(interval);
  }, [company, user, getExpiryInfo, card]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submitPayment = () => {
    if (!company || !receiptBase64) return;
    setUploading(true);
    const payment: Payment = {
      id: `pay_${Date.now()}`,
      companyKey: company.key,
      amount: 0, // Admin will set
      payment_date: new Date().toISOString(),
      status: 'pending',
      receipt_base64: receiptBase64,
    };
    addPayment(payment);
    toast.success("Chek yuborildi! Admin tez orada tasdiqlaydi.");
    setReceiptBase64(null);
    setUploading(false);
    setReminderOpen(false);
  };

  // HARD LOCK - 2+ days past expiry
  if (hardLocked && company?.subscription.status !== 'active') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Obuna muddati tugagan!</h1>
            <p className="text-muted-foreground text-sm">
              Tizimdan foydalanish uchun obuna to'lovini amalga oshiring.
            </p>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-2">To'lov kartasi:</p>
            {card.cardNumber ? (
              <>
                <p className="text-xl font-bold text-foreground tracking-widest">{card.cardNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.cardHolder}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Admin karta ma'lumotlarini hali kiritmagam. Iltimos, admin bilan bog'laning.</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {receiptBase64 ? '✅ Chek yuklandi' : 'Chek rasmini yuklang'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            {receiptBase64 && (
              <Button onClick={submitPayment} className="w-full" disabled={uploading}>
                <CreditCard className="h-4 w-4 mr-2" /> To'lovni yuborish
              </Button>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground">
            Chiqish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* 10-minute reminder dialog */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Clock className="h-5 w-5" /> Obuna to'lovini amalga oshiring!
            </DialogTitle>
            <DialogDescription>
              Obuna muddatingiz tugagan. 2 kun ichida to'lovni amalga oshirmasangiz, tizim to'liq bloklanadi.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">To'lov kartasi:</p>
            {card.cardNumber ? (
              <>
                <p className="text-lg font-bold text-foreground tracking-widest">{card.cardNumber}</p>
                <p className="text-sm text-muted-foreground">{card.cardHolder}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Admin karta ma'lumotlarini hali kiritmagan.</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {receiptBase64 ? '✅ Chek yuklandi' : 'Chek rasmini yuklang'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReminderOpen(false)}>Keyinroq</Button>
            {receiptBase64 && (
              <Button onClick={submitPayment} disabled={uploading}>
                <CreditCard className="h-4 w-4 mr-2" /> Yuborish
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
