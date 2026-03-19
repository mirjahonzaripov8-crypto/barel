import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Sparkles, PlusCircle, Loader2, Upload, CreditCard, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/helpers';
import { addFeatureRequest, getFeatureRequests, updateFeatureRequest, getAdminCard, addPayment, getCurrentStation, getStationData, type FeatureRequest, type Payment } from '@/lib/store';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

function buildCompanyData(company: any) {
  if (!company) return null;
  const stationIndex = getCurrentStation();
  const stationData = getStationData(company, stationIndex);
  
  // Get all stations data for multi-station analysis
  const allStationsData = company.stations?.map((name: string, i: number) => ({
    name,
    data: getStationData(company, i),
  })) || [];

  return {
    company: {
      name: company.name,
      plan: company.plan,
      stations: company.stations,
      fuelTypes: company.fuelTypes,
      users: company.users,
    },
    stationIndex,
    stationData,
    allStationsData,
  };
}

async function streamChat({
  messages,
  companyData,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  companyData: any;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, companyData }),
  });

  if (!resp.ok) {
    if (resp.status === 429) {
      onError("So'rovlar limiti oshib ketdi. Biroz kutib qayta urinib ko'ring.");
      return;
    }
    if (resp.status === 402) {
      onError("AI xizmati uchun kredit tugadi.");
      return;
    }
    const errData = await resp.json().catch(() => ({}));
    onError(errData.error || "AI xizmati xatosi");
    return;
  }

  if (!resp.body) {
    onError("Stream boshlanmadi");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

function FeaturePaymentSection({ request, onPaid, companyKey }: { request: FeatureRequest; onPaid: () => void; companyKey: string }) {
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const card = getAdminCard();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submitPayment = () => {
    if (!receiptBase64) return;
    setUploading(true);
    const payment: Payment = {
      id: `pay_feat_${Date.now()}`,
      companyKey,
      amount: request.price || 0,
      payment_date: new Date().toISOString(),
      status: 'pending',
      receipt_base64: receiptBase64,
    };
    addPayment(payment);
    updateFeatureRequest(request.id, (req: FeatureRequest) => ({
      ...req,
      status: 'paid' as const,
      updated_at: new Date().toISOString(),
    }));
    toast.success("Chek yuborildi! Admin tez orada tasdiqlaydi.");
    setUploading(false);
    onPaid();
  };

  return (
    <div className="mt-3 space-y-3">
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
        {request.price && (
          <p className="text-sm font-bold text-primary mt-2">To'lov summasi: {formatCurrency(request.price)}</p>
        )}
      </div>
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
  );
}

export default function AIAssistantPage() {
  const { company } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [featureDesc, setFeatureDesc] = useState('');
  const [myRequests, setMyRequests] = useState<FeatureRequest[]>([]);
  const [, setRefresh] = useState(0);
  const [dailyTip, setDailyTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (company) {
      const all = getFeatureRequests().filter(r => r.companyKey === company.key);
      setMyRequests(all);
    }
  }, [company]);

  // Load daily tip
  useEffect(() => {
    if (!company) return;
    const tipKey = `barel_daily_tip_${company.key}_${new Date().toISOString().split('T')[0]}`;
    const cached = localStorage.getItem(tipKey);
    if (cached) {
      setDailyTip(cached);
      return;
    }
    // Auto-generate daily tip
    generateDailyTip(tipKey);
  }, [company]);

  const generateDailyTip = useCallback(async (tipKey: string) => {
    if (!company || tipLoading) return;
    setTipLoading(true);
    const companyData = buildCompanyData(company);
    
    let tipText = "";
    try {
      await streamChat({
        messages: [{ role: "user", content: "Bugun korxonam uchun bitta eng muhim tavsiya ber. Qisqa va aniq bo'lsin. Raqamlar va foizlar bilan asosla. Faqat 2-3 jumla." }],
        companyData,
        onDelta: (chunk) => { tipText += chunk; },
        onDone: () => {
          setDailyTip(tipText);
          localStorage.setItem(tipKey, tipText);
          setTipLoading(false);
        },
        onError: (err) => {
          console.error("Tip error:", err);
          setTipLoading(false);
        },
      });
    } catch {
      setTipLoading(false);
    }
  }, [company, tipLoading]);

  const refreshRequests = () => {
    if (company) {
      setMyRequests(getFeatureRequests().filter(r => r.companyKey === company.key));
      setRefresh(r => r + 1);
    }
  };

  const send = async () => {
    if (!input.trim() || isStreaming || !company) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    let assistantSoFar = "";
    const companyData = buildCompanyData(company);

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        companyData,
        onDelta: upsertAssistant,
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          toast.error(err);
          setIsStreaming(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast.error("AI bilan bog'lanishda xatolik");
      setIsStreaming(false);
    }
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

  const quickPrompts = [
    'Operatorlarga haftalik maosh qancha berish kerak?',
    'Omborchiga oylik maosh tavsiya qil',
    'Korxonamni tahlil qil',
    'Foydani oshirish uchun maslahat ber',
    'Xarajatlarimni optimallashtir',
    'Qaysi mahsulot eng foydali?',
  ];

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

      {/* Daily Tip */}
      {(dailyTip || tipLoading) && (
        <div className="mb-4 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Bugungi tavsiya</h3>
          </div>
          {tipLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Tahlil qilinmoqda...
            </div>
          ) : (
            <p className="text-sm text-foreground leading-relaxed">{dailyTip}</p>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg flex flex-col h-[500px]">
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-primary/30 mb-3" />
              <p className="text-muted-foreground mb-2">Savolingizni yozing — AI korxonangizni tahlil qiladi!</p>
              <div className="flex flex-wrap gap-2 justify-center mt-3 max-w-md">
                {quickPrompts.map(s => (
                  <button key={s} onClick={() => setInput(s)} className="text-xs bg-secondary hover:bg-secondary/80 text-foreground px-3 py-1.5 rounded-full border border-border transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                {m.content}
                {isStreaming && i === messages.length - 1 && m.role === 'assistant' && (
                  <span className="inline-block w-1.5 h-4 bg-primary/60 ml-1 animate-pulse" />
                )}
              </div>
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Tahlil qilmoqda...</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Savolingizni yozing..."
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            rows={2}
            disabled={isStreaming}
          />
          <Button onClick={send} size="icon" className="self-end h-10 w-10" disabled={isStreaming}>
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
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
                  <FeaturePaymentSection request={r} onPaid={() => refreshRequests()} companyKey={company?.key || ''} />
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
