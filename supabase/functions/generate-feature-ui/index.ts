import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Sen SuperAdmin tomonidan yozilgan prompt asosida UI konfiguratsiya yaratuvchi AI san.

Foydalanuvchi senga o'zbek tilida funksiya tavsifini beradi. Sen shu tavsif asosida JSON formatda UI konfiguratsiya qaytarishing kerak.

JSON strukturasi:
{
  "type": "ledger" | "crud" | "tracker",
  "title": "string - funksiya nomi",
  "description": "string - qisqa tavsif",
  "icon": "vault" | "package" | "clipboard" | "users" | "truck" | "wrench" | "box" | "calculator" | "file-text" | "shopping-cart",
  "balanceField": { // faqat "ledger" turi uchun
    "label": "string - balans sarlavhasi",
    "unit": "sum" | "piece" | "liter" | "kg"
  },
  "actions": [
    {
      "id": "string",
      "label": "string - tugma matni",
      "variant": "default" | "outline" | "destructive",
      "direction": "in" | "out" | "neutral",
      "fields": [
        {
          "name": "string",
          "label": "string",
          "type": "number" | "text" | "select" | "date",
          "required": true/false,
          "placeholder": "string",
          "options": ["string"] // faqat select turi uchun
        }
      ]
    }
  ],
  "historyDisplay": {
    "enabled": true/false,
    "dateFilter": true/false,
    "showStats": true/false,
    "columns": [
      { "field": "string", "label": "string" }
    ]
  }
}

MUHIM QOIDALAR:
1. Prompt matnini diqqat bilan o'qi va barcha talablarni amalga oshir
2. "type" ni to'g'ri tanla:
   - "ledger" = pul, mahsulot, yoqilg'i kabi kirdi/chiqdi bor narsa
   - "crud" = ro'yxat, jadval, qo'shish/o'chirish
   - "tracker" = kuzatuv, monitoring
3. Har bir "action" uchun kerakli "fields" larni yoz
4. Faqat JSON qaytar, boshqa hech narsa yozma
5. title va labellarni o'zbek tilida yoz`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Juda ko'p so'rov, biroz kuting" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kredit tugadi" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();
    
    // Validate it's valid JSON
    const config = JSON.parse(content);

    return new Response(JSON.stringify({ config }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-feature-ui error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
