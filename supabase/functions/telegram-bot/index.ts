const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TELEGRAM_API = 'https://api.telegram.org/bot';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, chat_id, message, parse_mode } = body;

    if (action === 'verify') {
      // Verify chat_id by sending a test message
      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: '✅ BAREL.uz Telegram bot muvaffaqiyatli ulandi!\n\nSiz endi kunlik hisobotlar va bildirishnomalarni shu chatda olasiz.',
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();
      
      if (!data.ok) {
        return new Response(JSON.stringify({ success: false, error: data.description || 'Chat ID noto\'g\'ri' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send') {
      // Send a custom message
      if (!chat_id || !message) {
        return new Response(JSON.stringify({ error: 'chat_id and message required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: message,
          parse_mode: parse_mode || 'HTML',
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        return new Response(JSON.stringify({ success: false, error: data.description }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'daily_report') {
      // Send daily report
      const { company_name, report_date, fuels, total_sales, total_expenses, net_profit } = body;

      let text = `📊 <b>${company_name}</b>\n`;
      text += `📅 Kunlik hisobot: <b>${report_date}</b>\n\n`;

      if (fuels && fuels.length > 0) {
        text += `⛽ <b>Yoqilg'i sotuvi:</b>\n`;
        for (const f of fuels) {
          text += `  • ${f.type}: ${f.sold} ${f.unit} × ${f.price} = ${f.total} so'm\n`;
        }
        text += '\n';
      }

      text += `💰 Jami sotuv: <b>${total_sales} so'm</b>\n`;
      text += `📉 Xarajatlar: <b>${total_expenses} so'm</b>\n`;
      text += `📈 Sof foyda: <b>${net_profit} so'm</b>\n\n`;
      text += `🤖 BAREL.uz avtomatik hisobot`;

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text,
          parse_mode: 'HTML',
        }),
      });
      const data = await res.json();

      return new Response(JSON.stringify({ success: data.ok }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
