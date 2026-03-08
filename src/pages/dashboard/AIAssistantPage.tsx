import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/helpers';
import { addFeatureRequest, getFeatureRequests, type FeatureRequest } from '@/lib/store';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

function getCompanyAnalysis(company: any) {
  if (!company) return null;

  const data = company.data || [];
  const last7 = data.slice(-7);
  const last30 = data.slice(-30);

  const totalRevenue = last30.reduce((s: number, d: any) => s + d.fuels.reduce((a: number, f: any) => a + f.sold * f.price, 0), 0);
  const totalExpenses = last30.reduce((s: number, d: any) => s + d.expenses.reduce((a: number, e: any) => a + e.amount, 0), 0);
  const totalTerminal = last30.reduce((s: number, d: any) => s + (d.terminal || 0), 0);
  const totalCost = last30.reduce((s: number, d: any) => s + d.fuels.reduce((a: number, f: any) => a + (f.prixod || 0) * (f.tannarx || 0), 0), 0);
  const netProfit = totalRevenue - totalExpenses - totalCost;

  const fuelStats: Record<string, { sold: number; revenue: number; cost: number }> = {};
  last30.forEach((d: any) => {
    d.fuels.forEach((f: any) => {
      if (!fuelStats[f.type]) fuelStats[f.type] = { sold: 0, revenue: 0, cost: 0 };
      fuelStats[f.type].sold += f.sold;
      fuelStats[f.type].revenue += f.sold * f.price;
      fuelStats[f.type].cost += (f.prixod || 0) * (f.tannarx || 0);
    });
  });

  const lastDay = data[data.length - 1];
  const lastDayRevenue = lastDay ? lastDay.fuels.reduce((a: number, f: any) => a + f.sold * f.price, 0) : 0;
  const lastDayExpenses = lastDay ? lastDay.expenses.reduce((a: number, e: any) => a + e.amount, 0) : 0;

  const expReasons: Record<string, number> = {};
  last30.forEach((d: any) => {
    d.expenses.forEach((e: any) => {
      expReasons[e.reason] = (expReasons[e.reason] || 0) + e.amount;
    });
  });
  const topExpenses = Object.entries(expReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const avgDailyRevenue = last30.length > 0 ? totalRevenue / last30.length : 0;

  return {
    totalRevenue, totalExpenses, totalTerminal, totalCost, netProfit,
    fuelStats, lastDay, lastDayRevenue, lastDayExpenses,
    topExpenses, avgDailyRevenue, daysCount: last30.length,
    plan: company.plan, stationsCount: company.stations.length,
    fuelTypesCount: company.fuelTypes.length,
    workersCount: company.users.length,
  };
}

function generateAnswer(question: string, company: any): string {
  const q = question.toLowerCase().trim();
  const analysis = getCompanyAnalysis(company);

  if (!analysis) return "Korxona ma'lumotlari topilmadi. Iltimos, tizimga qaytadan kiring.";
  if (analysis.daysCount === 0) return "Hozircha hech qanday sotuv ma'lumoti kiritilmagan. Hisoblagich sahifasidan kunlik ma'lumot kiritishni boshlang.";

  if (/salom|assalom|hey|privet|hi\b/.test(q)) {
    return `Assalomu alaykum! Men BAREL.uz AI yordamchisiman. Korxonangiz haqida savollar bering — sotuv, xarajat, foyda, maslahat va boshqalar. Qanday yordam bera olaman?`;
  }

  if (/tushum|sotuv|daromad|revenue|savdo/.test(q)) {
    let resp = `📊 Oxirgi ${analysis.daysCount} kunda:\n\n`;
    resp += `💰 Jami tushum: ${formatCurrency(analysis.totalRevenue)}\n`;
    resp += `📈 Kunlik o'rtacha: ${formatCurrency(analysis.avgDailyRevenue)}\n\n`;
    resp += `Mahsulotlar bo'yicha:\n`;
    Object.entries(analysis.fuelStats).forEach(([name, s]: [string, any]) => {
      resp += `• ${name}: ${s.sold.toLocaleString()} L — ${formatCurrency(s.revenue)}\n`;
    });
    if (analysis.lastDay) {
      resp += `\nOxirgi kun tushumi: ${formatCurrency(analysis.lastDayRevenue)}`;
    }
    return resp;
  }

  if (/xarajat|harajat|chiqim|expense|sarf/.test(q)) {
    let resp = `📉 Oxirgi ${analysis.daysCount} kunda jami xarajat: ${formatCurrency(analysis.totalExpenses)}\n\n`;
    if (analysis.topExpenses.length > 0) {
      resp += `Eng katta xarajatlar:\n`;
      analysis.topExpenses.forEach(([reason, amount]) => {
        resp += `• ${reason}: ${formatCurrency(amount as number)}\n`;
      });
    }
    if (analysis.totalExpenses > analysis.totalRevenue * 0.3) {
      resp += `\n⚠️ Maslahat: Xarajatlaringiz tushumning ${Math.round(analysis.totalExpenses / analysis.totalRevenue * 100)}% ni tashkil qilmoqda. Bu ko'rsatkichni 20-25% gacha kamaytirishga harakat qiling.`;
    }
    return resp;
  }

  if (/foyda|profit|daromad|sof|net|natija/.test(q)) {
    let resp = `💵 Oxirgi ${analysis.daysCount} kun moliyaviy natijasi:\n\n`;
    resp += `Tushum: ${formatCurrency(analysis.totalRevenue)}\n`;
    resp += `Xarajatlar: ${formatCurrency(analysis.totalExpenses)}\n`;
    resp += `Tannarx (prixod): ${formatCurrency(analysis.totalCost)}\n`;
    resp += `Terminal: ${formatCurrency(analysis.totalTerminal)}\n`;
    resp += `━━━━━━━━━━━━\n`;
    resp += `SOF FOYDA: ${formatCurrency(analysis.netProfit)}\n\n`;
    if (analysis.netProfit > 0) {
      resp += `✅ Korxonangiz foydada ishlayapti.`;
      const margin = Math.round(analysis.netProfit / analysis.totalRevenue * 100);
      resp += ` Foyda margini: ${margin}%.`;
      if (margin < 10) resp += ` Margini oshirish uchun tannarxni kamaytirish yoki narxlarni ko'tarish maslahat beriladi.`;
    } else {
      resp += `❌ Korxona zararда ishlayapti! Xarajatlarni kamaytiring yoki sotuv narxlarini qayta ko'rib chiqing.`;
    }
    return resp;
  }

  if (/terminal/.test(q)) {
    const termPercent = analysis.totalRevenue > 0 ? Math.round(analysis.totalTerminal / analysis.totalRevenue * 100) : 0;
    return `💳 Oxirgi ${analysis.daysCount} kunda terminal orqali: ${formatCurrency(analysis.totalTerminal)} (umumiy tushumning ${termPercent}%)\n\nNaqd pul: ${formatCurrency(analysis.totalRevenue - analysis.totalTerminal - analysis.totalExpenses)}`;
  }

  if (/mahsulot|yoqilgi|benzin|propan|dizel|metan|ai-9|fuel/.test(q)) {
    let resp = `⛽ Mahsulotlar tahlili (oxirgi ${analysis.daysCount} kun):\n\n`;
    Object.entries(analysis.fuelStats).forEach(([name, s]: [string, any]) => {
      const profit = s.revenue - s.cost;
      resp += `🔹 ${name}:\n`;
      resp += `  Sotilgan: ${s.sold.toLocaleString()} L\n`;
      resp += `  Tushum: ${formatCurrency(s.revenue)}\n`;
      resp += `  Tannarx: ${formatCurrency(s.cost)}\n`;
      resp += `  Foyda: ${formatCurrency(profit)}\n\n`;
    });
    const best = Object.entries(analysis.fuelStats).sort((a: any, b: any) => b[1].revenue - a[1].revenue)[0];
    if (best) resp += `🏆 Eng ko'p sotuv: ${best[0]}`;
    return resp;
  }

  if (/maslahat|tavsiya|advice|nima qilish|yaxshilash|taklif/.test(q)) {
    let resp = `💡 Korxonangiz uchun maslahatlar:\n\n`;
    const margin = analysis.totalRevenue > 0 ? analysis.netProfit / analysis.totalRevenue : 0;

    if (margin < 0.1) resp += `1. ⚠️ Foyda margini past (${Math.round(margin*100)}%). Narxlarni ko'tarishni yoki arzonroq yetkazib beruvchi topishni o'ylang.\n\n`;
    else resp += `1. ✅ Foyda margini yaxshi (${Math.round(margin*100)}%). Davom ettiring!\n\n`;

    if (analysis.totalExpenses > analysis.totalRevenue * 0.25) {
      resp += `2. 📉 Xarajatlar tushumning ${Math.round(analysis.totalExpenses/analysis.totalRevenue*100)}% ni tashkil qilmoqda. Eng katta xarajat: ${analysis.topExpenses[0]?.[0] || '—'} (${formatCurrency((analysis.topExpenses[0]?.[1] as number) || 0)}). Kamaytirishga harakat qiling.\n\n`;
    } else {
      resp += `2. ✅ Xarajatlar nazorat ostida.\n\n`;
    }

    const termPercent = analysis.totalRevenue > 0 ? analysis.totalTerminal / analysis.totalRevenue : 0;
    resp += `3. 💳 Terminal ulushi: ${Math.round(termPercent*100)}%. ${termPercent > 0.5 ? 'Terminal to\'lovlar ko\'p — naqd pul oqimiga e\'tibor bering.' : 'Naqd pul oqimi yaxshi.'}\n\n`;

    const fuels = Object.entries(analysis.fuelStats).map(([n, s]: [string, any]) => ({ name: n, profit: s.revenue - s.cost, sold: s.sold }));
    const best = fuels.sort((a, b) => b.profit - a.profit)[0];
    const worst = fuels.sort((a, b) => a.profit - b.profit)[0];
    if (best) resp += `4. 🏆 Eng foydali mahsulot: ${best.name} (${formatCurrency(best.profit)} foyda)\n`;
    if (worst && fuels.length > 1) resp += `5. 📊 Eng kam foydali: ${worst.name} — narxni oshirish yoki tannarxni kamaytirish maslahat.\n`;


    return resp;
  }

  if (/korxona|kompaniya|info|ma'lumot|haqida/.test(q)) {
    return `🏢 Korxona: ${company.name}\n📋 Tarif: ${company.plan}\n⛽ Zapravkalar: ${analysis.stationsCount} ta\n🔧 Mahsulot turlari: ${analysis.fuelTypesCount} ta\n👥 Ishchilar: ${analysis.workersCount} ta\n📅 Ma'lumot: ${analysis.daysCount} kunlik`;
  }

  if (/yordam|help|nima|qanday|bilasanmi|nimalar/.test(q)) {
    return `Men quyidagi savollarga javob bera olaman:\n\n• 💰 Sotuv va tushum haqida\n• 📉 Xarajatlar tahlili\n• 💵 Foyda va zarar\n• 💳 Terminal ma'lumotlari\n• ⛽ Mahsulotlar tahlili\n• 💡 Maslahat va tavsiyalar\n• 🏢 Korxona ma'lumotlari\n\nMasalan: "Foydamni ko'rsat", "Maslahat ber", "Qaysi mahsulot eng foydali?"`;
  }

  const appKeywords = /sotuv|sotil|tushum|xarajat|harajat|foyda|zarar|terminal|mahsulot|yoqilgi|benzin|propan|dizel|metan|narx|pul|summa|kassa|litr|korxona|zapravka|ishchi|operator|plomba|hisoblagich|moliya|arxiv|referal|tarif|obuna|maslahat|tavsiya|tahlil|statistika|grafik|pdf|parol|lock|blok/;

  if (!appKeywords.test(q)) {
    return `❌ Kechirasiz, men faqat korxona va ilova bilan bog'liq savollarga javob beraman.\n\nMen yordam bera oladigan mavzular:\n• 💰 Sotuv va tushum\n• 📉 Xarajatlar\n• 💵 Foyda va zarar\n• ⛽ Mahsulotlar tahlili\n• 💡 Maslahat va tavsiyalar\n\nMasalan: "Foydamni ko'rsat", "Maslahat ber", "Xarajatlarim qancha?"`;
  }

  let resp = `📊 Korxonangiz haqida qisqacha:\n\n`;
  resp += `💰 Oxirgi ${analysis.daysCount} kun tushumi: ${formatCurrency(analysis.totalRevenue)}\n`;
  resp += `💵 Sof foyda: ${formatCurrency(analysis.netProfit)}\n`;
  resp += `📉 Xarajatlar: ${formatCurrency(analysis.totalExpenses)}\n\n`;
  resp += `Aniqroq javob olish uchun so'rang:\n• "Sotuv qancha?"\n• "Xarajatlarim nima?"\n• "Maslahat ber"\n• "Qaysi mahsulot foydali?"`;
  return resp;
}

export default function AIAssistantPage() {
  const { company } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [featureDesc, setFeatureDesc] = useState('');
  const [myRequests, setMyRequests] = useState<FeatureRequest[]>([]);
  const [, setRefresh] = useState(0);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (company) {
      const all = getFeatureRequests().filter(r => r.companyKey === company.key);
      setMyRequests(all);
    }
  }, [company]);

  const refreshRequests = () => {
    if (company) {
      setMyRequests(getFeatureRequests().filter(r => r.companyKey === company.key));
      setRefresh(r => r + 1);
    }
  };

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);

    const answer = generateAnswer(input, company);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
    }, 300);
    setInput('');
  };

  const submitFeatureRequest = () => {
    if (!featureDesc.trim() || !company) return;
    const req: FeatureRequest = {
      id: `fr_${Date.now()}`,
      companyKey: company.key,
      companyName: company.name,
      description: featureDesc.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addFeatureRequest(req);
    toast.success("So'rov yuborildi! Admin tez orada javob beradi.");
    setFeatureDesc('');
    setFeatureOpen(false);
    refreshRequests();
  };

  const getStatusBadge = (status: FeatureRequest['status']) => {
    switch (status) {
      case 'pending': return <span className="text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning font-medium">Kutilmoqda</span>;
      case 'priced': return <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">Narx belgilandi</span>;
      case 'paid': return <span className="text-xs px-2 py-0.5 rounded-md bg-accent/50 text-accent-foreground font-medium">To'langan</span>;
      case 'done': return <span className="text-xs px-2 py-0.5 rounded-md bg-success/10 text-success font-medium">Bajarildi ✅</span>;
      case 'rejected': return <span className="text-xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-medium">Rad etildi</span>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">AI yordamchi</h1>
          <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI</span>
        </div>
        <Button onClick={() => setFeatureOpen(true)} variant="outline" className="gap-2">
          <PlusCircle className="h-4 w-4" /> Funksiya qo'shish
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg flex flex-col h-[500px]">
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-primary/30 mb-3" />
              <p className="text-muted-foreground mb-2">Savolingizni yozing — korxonangiz ma'lumotlarini tahlil qilaman!</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {['Sotuv qancha?', 'Maslahat ber', 'Foydamni ko\'rsat', 'Xarajatlarim'].map(s => (
                  <button key={s} onClick={() => { setInput(s); }} className="text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-full border border-border transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Savolingizni yozing..."
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
          />
          <Button onClick={send} size="icon" className="self-end h-10 w-10"><Send className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* My feature requests */}
      {myRequests.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Mening so'rovlarim</h2>
          <div className="space-y-3">
            {[...myRequests].reverse().map(r => (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-foreground">{r.description}</p>
                  {getStatusBadge(r.status)}
                </div>
                {r.adminResponse && (
                  <div className="mt-2 bg-secondary/50 rounded-md p-3">
                    <p className="text-xs text-muted-foreground mb-1">Admin javobi:</p>
                    <p className="text-sm text-foreground">{r.adminResponse}</p>
                    {r.price && <p className="text-sm font-bold text-primary mt-1">Narxi: {formatCurrency(r.price)}</p>}
                  </div>
                )}
                {r.status === 'priced' && (
                  <Button size="sm" className="mt-2" onClick={() => {
                    // Mark as paid
                    const { updateFeatureRequest } = require('@/lib/store');
                    updateFeatureRequest(r.id, (req: FeatureRequest) => ({ ...req, status: 'paid' as const, updated_at: new Date().toISOString() }));
                    toast.success("To'lov tasdiqlandi! Admin tez orada funksiyani qo'shadi.");
                    refreshRequests();
                  }}>
                    To'lovni tasdiqlash
                  </Button>
                )}
                {r.status === 'done' && r.adminPrompt && (
                  <div className="mt-2 bg-success/5 border border-success/20 rounded-md p-3">
                    <p className="text-xs text-success font-medium">✅ Funksiya qo'shildi!</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">{new Date(r.created_at).toLocaleDateString('uz-UZ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Request Dialog */}
      <Dialog open={featureOpen} onOpenChange={setFeatureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" /> Yangi funksiya so'rash
            </DialogTitle>
            <DialogDescription>
              Qanday funksiya qo'shmoqchisiz? Batafsil tavsiflab bering va admin javob beradi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={featureDesc}
              onChange={e => setFeatureDesc(e.target.value)}
              placeholder="Masalan: Har oylik moliyaviy hisobotni PDF formatda avtomatik yaratish funksiyasi kerak..."
              rows={5}
              className="resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFeatureOpen(false)}>Bekor</Button>
            <Button onClick={submitFeatureRequest} disabled={!featureDesc.trim()}>
              <Send className="h-4 w-4 mr-2" /> Yuborish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
