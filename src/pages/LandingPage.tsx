import { Fuel, BarChart3, Shield, Clock, Users, FileText, Zap, Award, ChevronRight, Check, Phone, MapPin, Send, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { PLANS, type PlanKey, getPlanFeaturesWithCustom } from '@/lib/helpers';
import { getContacts } from '@/lib/store';

const steps = [
  { num: 1, title: "Ro'yxatdan o'ting", desc: "Korxona ma'lumotlarini kiriting va 7 kunlik bepul sinovdan foydalaning." },
  { num: 2, title: "Zapravkani sozlang", desc: "Yoqilg'i turlari, narxlar va operatorlarni qo'shing." },
  { num: 3, title: "Boshqarishni boshlang", desc: "Kunlik hisoblagich, moliya, arxiv — barchasi bir joyda." },
];

const features = [
  { icon: BarChart3, title: "Moliya tahlili", desc: "Tushum, xarajat, sof foyda — real vaqtda" },
  { icon: Clock, title: "Kunlik hisoblagich", desc: "Shochig ma'lumotlarini kunlik kiritish va kuzatish" },
  { icon: Users, title: "Xodimlar boshqaruvi", desc: "Ishchilar, rollar va faollik tarixi" },
  { icon: Shield, title: "Xavfsizlik", desc: "Plomba nazorati va kirish blokirovkalari" },
  { icon: FileText, title: "PDF hisobotlar", desc: "Professional PDF eksport — moliya, arxiv, xarajatlar" },
  { icon: Award, title: "Referral tizimi", desc: "Do'stlaringizni taklif qiling, chegirma oling" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const contacts = getContacts();

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-secondary">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-foreground tracking-tight">BAREL<span className="text-primary">.uz</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Xizmatlar</a>
            <a href="#pricing" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Tariflar</a>
            <a href="#contact" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Kontakt</a>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/login')} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">Kirish</Button>
            <Button onClick={() => navigate('/register')}>Ro'yxatdan o'tish</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/60 to-card" />
        <div className="relative container mx-auto px-4 py-20 md:py-32 text-center">
          <div className="animate-fade-in max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-secondary rounded-full px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="h-4 w-4" /> Yoqilg'i biznesini boshqarish tizimi
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight mb-6">
              Zapravkangizni <span className="text-primary">raqamlashtiring</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Kunlik sotuv, moliya, xarajatlar, xodimlar — barcha boshqaruvni bitta platformada olib boring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/register')} className="text-base px-8 h-12 shadow-button hover:-translate-y-0.5 transition-transform">
                Hozir sozlash <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-base px-8 h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                Kirish
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">Qanday ishlaydi?</h2>
        <div className="grid md:grid-cols-3 gap-6 stagger-children">
          {steps.map((s) => (
            <div key={s.num} className="bg-card border border-secondary rounded-lg p-6 text-center hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 rounded-full bg-brand-deep flex items-center justify-center text-primary-foreground text-lg font-bold mx-auto mb-4">{s.num}</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-muted-foreground text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-secondary/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-12">Imkoniyatlar</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-secondary rounded-lg p-6 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <f.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground mb-4">Tariflar</h2>
        <p className="text-center text-muted-foreground mb-12">Barcha tariflarda 7 kunlik bepul sinov</p>
        <div className="grid md:grid-cols-3 gap-6 stagger-children">
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const plan = PLANS[key];
            const isPopular = 'popular' in plan && plan.popular;
            return (
              <div key={key} className={`relative bg-card border rounded-lg p-6 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${isPopular ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-secondary'}`}>
                {isPopular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">ENG OMMABOP</div>}
                <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-primary">{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm ml-1">so'm/oy</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {getPlanFeaturesWithCustom(key).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-success flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button onClick={() => navigate(`/register?plan=${key}`)} className="w-full" variant={isPopular ? 'default' : 'outline'}>
                  7 kun bepul
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-secondary/30 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Bog'lanish</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`tel:${contacts.phone}`} className="inline-flex items-center gap-3 bg-card border border-secondary rounded-lg px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all">
              <Phone className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{contacts.phone}</span>
            </a>
            <a href={`https://t.me/${contacts.telegramBot.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-card border border-secondary rounded-lg px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all">
              <Send className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">{contacts.telegramBot}</span>
            </a>
            <a href={contacts.telegramChannel} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-card border border-secondary rounded-lg px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all">
              <Send className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">Telegram kanal</span>
            </a>
            <a href={contacts.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-card border border-secondary rounded-lg px-6 py-4 hover:border-primary/30 hover:shadow-md transition-all">
              <Instagram className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold text-foreground">Instagram</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-primary-foreground py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="h-5 w-5" />
            <span className="text-lg font-bold">BAREL.uz</span>
          </div>
          <p className="text-primary-foreground/70 text-sm">© {new Date().getFullYear()} BAREL.uz — Yoqilg'i biznesini boshqarish tizimi</p>
        </div>
      </footer>
    </div>
  );
}
