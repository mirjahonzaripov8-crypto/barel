import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, Bot, CheckCircle, AlertCircle, Loader2, MessageSquare, Clock, Bell } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/helpers';

export default function TelegramPage() {
  const { company } = useAuth();
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState(false);
  const [reportTime, setReportTime] = useState('20:00');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const isPremium = company?.plan === 'PREMIUM';

  useEffect(() => {
    if (company?.key) loadSettings();
  }, [company?.key]);

  async function loadSettings() {
    const { data } = await supabase
      .from('telegram_settings')
      .select('*')
      .eq('company_key', company!.key)
      .maybeSingle();

    if (data) {
      setChatId(data.chat_id || '');
      setEnabled(data.enabled || false);
      setLiveNotifications(data.live_notifications || false);
      setReportTime(data.daily_report_time || '20:00');
      if (data.chat_id) setVerified(true);
    }
  }

  async function handleVerify() {
    if (!chatId.trim()) {
      toast.error('Chat ID kiriting');
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: { action: 'verify', chat_id: chatId.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        setVerified(true);
        toast.success('Telegram bot muvaffaqiyatli ulandi!');
        await saveSettings();
      } else {
        toast.error(data?.error || 'Chat ID tekshirishda xatolik');
      }
    } catch (err: any) {
      toast.error(err.message || 'Xatolik yuz berdi');
    } finally {
      setVerifying(false);
    }
  }

  async function saveSettings() {
    setLoading(true);
    try {
      // Save company users and fuel types for bot auth
      const companyData = {
        users: company!.users.map(u => ({ login: u.login, password: u.password, name: u.name, role: u.role })),
        fuelTypes: company!.fuelTypes.map(f => f.name),
        companyName: company!.name,
      };
      const { error } = await supabase
        .from('telegram_settings')
        .upsert({
          company_key: company!.key,
          chat_id: chatId.trim(),
          enabled,
          daily_report_time: reportTime,
          live_notifications: isPremium ? liveNotifications : false,
          company_data: companyData,
        } as any, { onConflict: 'company_key' });

      if (error) throw error;
      toast.success('Sozlamalar saqlandi');
    } catch (err: any) {
      toast.error(err.message || 'Saqlashda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function sendTestReport() {
    if (!chatId || !verified) {
      toast.error('Avval Chat ID ni tekshiring');
      return;
    }
    setSendingReport(true);
    try {
      const lastDay = company?.data[company.data.length - 1];
      const fuels = lastDay?.fuels.map(f => ({
        type: f.type,
        sold: formatNumber(f.sold),
        unit: company?.fuelTypes.find(ft => ft.name === f.type)?.unit || 'L',
        price: formatNumber(f.price),
        total: formatNumber(f.sold * f.price),
      })) || [];

      const totalSales = lastDay?.fuels.reduce((s, f) => s + f.sold * f.price, 0) || 0;
      const totalExpenses = lastDay?.expenses.reduce((s, e) => s + e.amount, 0) || 0;

      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: {
          action: 'daily_report',
          chat_id: chatId,
          company_name: company?.name,
          report_date: lastDay?.date || new Date().toISOString().split('T')[0],
          fuels,
          total_sales: formatNumber(totalSales),
          total_expenses: formatNumber(totalExpenses),
          net_profit: formatNumber(totalSales - totalExpenses),
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Kunlik hisobot Telegramga yuborildi!');
      } else {
        toast.error('Hisobot yuborishda xatolik');
      }
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    } finally {
      setSendingReport(false);
    }
  }

  async function sendLiveMessage() {
    if (!chatId || !verified) {
      toast.error('Avval Chat ID ni tekshiring');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('telegram-bot', {
        body: {
          action: 'send',
          chat_id: chatId,
          message: `🔔 <b>BAREL.uz jonli xabar</b>\n\n📍 ${company?.name}\n⏰ ${new Date().toLocaleString('uz-UZ')}\n\n✅ Tizim ishlayapti`,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Jonli xabar yuborildi!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    }
  }

  if (!company) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Telegram Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kunlik hisobotlar va bildirishnomalarni Telegram orqali oling
        </p>
      </div>

      {/* Connection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Bot ulanishi
          </CardTitle>
          <CardDescription>
            Telegram botini ulash uchun @BAREluz_bot ga /start buyrug'ini yuboring va Chat ID ni kiriting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium text-foreground">📋 Qanday ulash:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Telegramda <b>@BAREluz_bot</b> ni toping</li>
              <li><b>/start</b> buyrug'ini yuboring</li>
              <li>Bot bergan <b>Chat ID</b> ni quyidagi maydonga kiriting</li>
              <li><b>"Tekshirish"</b> tugmasini bosing</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Guruh uchun: botni guruhga qo'shing va guruh Chat ID sini kiriting (masalan: -1001234567890)
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Chat ID kiriting (masalan: 123456789)"
              value={chatId}
              onChange={e => { setChatId(e.target.value); setVerified(false); }}
              className="flex-1"
            />
            <Button onClick={handleVerify} disabled={verifying || !chatId.trim()}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : verified ? <CheckCircle className="h-4 w-4" /> : 'Tekshirish'}
            </Button>
          </div>
          {verified && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Bot muvaffaqiyatli ulangan
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Sozlamalar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Kunlik hisobot</p>
              <p className="text-xs text-muted-foreground">Har kuni avtomatik hisobot yuborish</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Yuborish vaqti:</span>
              <Input
                type="time"
                value={reportTime}
                onChange={e => setReportTime(e.target.value)}
                className="w-32"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                Jonli bildirishnomalar
                {!isPremium && <Badge variant="secondary" className="text-xs">Premium</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">Har bir sotuv va o'zgarish haqida darhol xabar</p>
            </div>
            <Switch
              checked={liveNotifications}
              onCheckedChange={setLiveNotifications}
              disabled={!isPremium}
            />
          </div>

          <Button onClick={saveSettings} disabled={loading || !verified} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Sozlamalarni saqlash
          </Button>
        </CardContent>
      </Card>

      {/* Test Actions */}
      {verified && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Test xabarlar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={sendTestReport}
              disabled={sendingReport}
              className="flex-1"
            >
              {sendingReport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Kunlik hisobot yuborish
            </Button>
            {isPremium && (
              <Button
                variant="outline"
                onClick={sendLiveMessage}
                className="flex-1"
              >
                <Bell className="h-4 w-4 mr-2" />
                Jonli xabar yuborish
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
