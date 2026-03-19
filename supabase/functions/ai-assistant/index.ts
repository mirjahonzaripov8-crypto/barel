import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function numFmt(n: number): string {
  return n.toLocaleString('uz-UZ');
}

function buildSystemPrompt(companyData: any): string {
  const { company, stationIndex, stationData, allStationsData } = companyData;
  
  // Calculate comprehensive analytics
  const data = stationData || [];
  const last7 = data.slice(-7);
  const last30 = data.slice(-30);
  
  let totalRevenue = 0, totalExpenses = 0, totalTerminal = 0, totalCost = 0;
  let totalSoldLiters = 0;
  const fuelStats: Record<string, { sold: number; revenue: number; cost: number; prixod: number }> = {};
  const expReasons: Record<string, number> = {};
  const dailyRevenues: number[] = [];
  const dailyProfits: number[] = [];
  
  last30.forEach((d: any) => {
    let dayRev = 0;
    d.fuels?.forEach((f: any) => {
      const sold = f.sold || 0;
      const price = f.price || 0;
      const prixod = f.prixod || 0;
      const tannarx = f.tannarx || 0;
      const rev = sold * price;
      const cost = prixod * tannarx;
      dayRev += rev;
      totalRevenue += rev;
      totalCost += cost;
      totalSoldLiters += sold;
      if (!fuelStats[f.type]) fuelStats[f.type] = { sold: 0, revenue: 0, cost: 0, prixod: 0 };
      fuelStats[f.type].sold += sold;
      fuelStats[f.type].revenue += rev;
      fuelStats[f.type].cost += cost;
      fuelStats[f.type].prixod += prixod;
    });
    const dayExp = d.expenses?.reduce((a: number, e: any) => a + (e.amount || 0), 0) || 0;
    totalExpenses += dayExp;
    totalTerminal += d.terminal || 0;
    dailyRevenues.push(dayRev);
    dailyProfits.push(dayRev - dayExp - (d.fuels?.reduce((a: number, f: any) => a + (f.prixod || 0) * (f.tannarx || 0), 0) || 0));
    
    d.expenses?.forEach((e: any) => {
      expReasons[e.reason] = (expReasons[e.reason] || 0) + (e.amount || 0);
    });
  });
  
  const netProfit = totalRevenue - totalExpenses - totalCost;
  const avgDailyRevenue = last30.length > 0 ? totalRevenue / last30.length : 0;
  const avgDailyProfit = last30.length > 0 ? netProfit / last30.length : 0;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;
  
  const topExpenses = Object.entries(expReasons).sort((a, b) => b[1] - a[1]).slice(0, 5);
  
  // Fuel analysis
  const fuelAnalysis = Object.entries(fuelStats).map(([name, s]) => ({
    name,
    sold: s.sold,
    revenue: s.revenue,
    cost: s.cost,
    profit: s.revenue - s.cost,
    margin: s.revenue > 0 ? ((s.revenue - s.cost) / s.revenue * 100) : 0,
  })).sort((a, b) => b.profit - a.profit);
  
  // Weekly trend
  const last7Revenue = last7.reduce((s: number, d: any) => s + (d.fuels?.reduce((a: number, f: any) => a + (f.sold || 0) * (f.price || 0), 0) || 0), 0);
  const prev7 = data.slice(-14, -7);
  const prev7Revenue = prev7.reduce((s: number, d: any) => s + (d.fuels?.reduce((a: number, f: any) => a + (f.sold || 0) * (f.price || 0), 0) || 0), 0);
  const weekTrend = prev7Revenue > 0 ? ((last7Revenue - prev7Revenue) / prev7Revenue * 100) : 0;
  
  // Workers info
  const workers = company.users || [];
  const operators = workers.filter((u: any) => u.role === 'OPERATOR');
  const omborchilar = workers.filter((u: any) => u.role === 'OMBORCHI');
  const bosses = workers.filter((u: any) => u.role === 'BOSS');
  
  // Multi-station info
  let allStationsSummary = '';
  if (allStationsData && allStationsData.length > 1) {
    allStationsSummary = '\n\nBarcha shoxobchalar ma\'lumoti:\n';
    allStationsData.forEach((sd: any, i: number) => {
      const stData = sd.data || [];
      const last30st = stData.slice(-30);
      const stRev = last30st.reduce((s: number, d: any) => s + (d.fuels?.reduce((a: number, f: any) => a + (f.sold || 0) * (f.price || 0), 0) || 0), 0);
      const stExp = last30st.reduce((s: number, d: any) => s + (d.expenses?.reduce((a: number, e: any) => a + (e.amount || 0), 0) || 0), 0);
      const stCost = last30st.reduce((s: number, d: any) => s + (d.fuels?.reduce((a: number, f: any) => a + (f.prixod || 0) * (f.tannarx || 0), 0) || 0), 0);
      allStationsSummary += `  ${sd.name}: Tushum=${numFmt(stRev)}, Xarajat=${numFmt(stExp)}, Tannarx=${numFmt(stCost)}, Foyda=${numFmt(stRev - stExp - stCost)}\n`;
    });
  }

  return `Sen BAREL.uz - yoqilg'i shoxobchasi boshqaruv tizimining AI maslahatchisisаn.
Korxona nomi: ${company.name}
Tarif rejasi: ${company.plan}
Shoxobchalar soni: ${company.stations?.length || 1}
Joriy shoxobcha: ${company.stations?.[stationIndex] || company.name}
Ishchilar: ${workers.length} ta (${bosses.length} boss, ${operators.length} operator, ${omborchilar.length} omborchi)

MOLIYAVIY MA'LUMOTLAR (oxirgi ${last30.length} kun):
- Jami tushum: ${numFmt(totalRevenue)} so'm
- Jami xarajat: ${numFmt(totalExpenses)} so'm
- Jami tannarx (prixod): ${numFmt(totalCost)} so'm
- Terminal: ${numFmt(totalTerminal)} so'm
- SOF FOYDA: ${numFmt(netProfit)} so'm
- Foyda margini: ${profitMargin.toFixed(1)}%
- Kunlik o'rtacha tushum: ${numFmt(Math.round(avgDailyRevenue))} so'm
- Kunlik o'rtacha foyda: ${numFmt(Math.round(avgDailyProfit))} so'm
- Haftalik trend: ${weekTrend > 0 ? '+' : ''}${weekTrend.toFixed(1)}% (bu hafta vs oldingi hafta)
- Jami sotilgan litr: ${numFmt(totalSoldLiters)} L

MAHSULOTLAR TAHLILI:
${fuelAnalysis.map(f => `- ${f.name}: ${numFmt(f.sold)} L sotildi, tushum ${numFmt(f.revenue)}, foyda ${numFmt(f.profit)} (margin ${f.margin.toFixed(1)}%)`).join('\n')}

ENG KATTA XARAJATLAR:
${topExpenses.map(([reason, amount]) => `- ${reason}: ${numFmt(amount)} so'm`).join('\n') || '- Hech qanday xarajat yo\'q'}
${allStationsSummary}

ISHCHILAR RO'YXATI:
${workers.map((w: any) => `- ${w.name} (${w.role})`).join('\n')}

SEN QUYIDAGILARNI QILA OLASAN:
1. Korxona moliyaviy holatini batafsil tahlil qilish
2. Operatorlarga haftalik maosh miqdorini tavsiya qilish (sotuv hajmi, foyda va bozor narxlaridan kelib chiqib)
3. Omborchilarga oylik maosh miqdorini tavsiya qilish
4. Har kuni bossga 1 ta aniq, amaliy tavsiya berish (foyda oshirish, xarajat kamaytirish, samaradorlik oshirish)
5. Mahsulotlarni tahlil qilib qaysi biri ko'proq foyda keltirayotganini ko'rsatish
6. Xarajatlarni optimallashtirish bo'yicha maslahat berish

MAOSH TAVSIYASI QOIDALARI:
- Operator haftalik maoshi: Kunlik o'rtacha sotuv hajmi va foydadan kelib chiqib hisoblash. Odatda sof foydaning 3-5% ini operatorlar soni bo'yicha taqsimlash
- Omborchi oylik maoshi: Ombor samaradorligi va umumiy foydadan kelib chiqib, odatda oylik sof foydaning 5-8% ni omborchilar soniga bo'lib hisoblash
- Maoshlarni hisoblashda O'zbekiston bozor narxlarini hisobga olish (2024-2025 yillar uchun operator min 1.5-3 mln, omborchi 2-4 mln so'm)
- Agar foyda juda past bo'lsa, minimal maosh tavsiya qilish va foydani oshirish bo'yicha maslahat berish

KUNLIK TAVSIYA QOIDALARI:
- Har doim korxonaning hozirgi moliyaviy holatidan kelib chiq
- Aniq raqamlar va foizlar bilan tavsiya ber
- Amaliy va bajarilishi mumkin bo'lgan tavsiyalar ber
- Tavsiya korxonani yaxshilashga qaratilgan bo'lsin

MUHIM: Faqat O'zbek tilida javob ber. Faqat korxona va biznes bilan bog'liq savollarga javob ber. Boshqa mavzulardagi savollarga "Men faqat korxona va biznes masalalari bo'yicha yordam bera olaman" deb javob ber.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, companyData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(companyData);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "So'rovlar limiti oshib ketdi, biroz kuting." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI xizmati uchun kredit tugadi." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI xizmati xatosi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Noma'lum xato" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
