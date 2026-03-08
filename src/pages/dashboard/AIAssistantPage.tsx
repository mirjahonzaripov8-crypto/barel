import { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export default function AIAssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);

    // Mock AI response
    const responses = [
      "Bugungi sotuv ma'lumotlarini ko'rib chiqaylik. Bosh sahifadagi grafikni tekshirib ko'ring.",
      "Xarajatlarni kamaytirish uchun oylik doimiy xarajatlaringizni tekshiring.",
      "Moliya sahifasida tannarx sozlamalarini yangilashni unutmang.",
      "Hisoblagichda kunlik ma'lumotlarni o'z vaqtida kiritish muhim.",
      "Referral tizimidan foydalanib, qo'shimcha chegirmalar oling!",
    ];
    const aiMsg: Message = { role: 'ai', text: responses[Math.floor(Math.random() * responses.length)] };
    setTimeout(() => setMessages(prev => [...prev, aiMsg]), 500);
    setInput('');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-foreground">AI yordamchi</h1>
        <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><Sparkles className="h-3 w-3" /> Premium</span>
      </div>

      <div className="bg-card border border-border rounded-lg flex flex-col h-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-primary/30 mb-3" />
              <p className="text-muted-foreground">Savolingizni yozing, men yordam beraman!</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
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
    </div>
  );
}
