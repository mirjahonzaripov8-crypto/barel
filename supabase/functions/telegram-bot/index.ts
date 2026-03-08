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

    const url = new URL(req.url);
    
    // Telegram webhook handler (POST from Telegram servers)
    if (url.pathname.endsWith('/webhook')) {
      const update = await req.json();
      console.log('Telegram update received:', JSON.stringify(update));
      
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const firstName = update.message.from?.first_name || 'Foydalanuvchi';
        
        if (text === '/start') {
          const responseText = `👋 Salom, ${firstName}!\n\n` +
            `🤖 BAREL.uz Telegram botiga xush kelibsiz!\n\n` +
            `📋 Sizning Chat ID: <code>${chatId}</code>\n\n` +
            `👆 Ushbu raqamni nusxalab, BAREL.uz dashboardidagi Telegram sozlamalariga kiriting.\n\n` +
            `✅ Shundan so'ng siz kunlik hisobotlar va bildirishnomalarni olishingiz mumkin bo'ladi.`;
          
          await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText,
              parse_mode: 'HTML',
            }),
          });
        } else if (text === '/help') {
          const helpText = `📖 <b>BAREL.uz Bot Yordam</b>\n\n` +
            `/start - Chat ID ni olish\n` +
            `/help - Yordam\n\n` +
            `🔗 Batafsil: barel.uz`;
          
          await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: helpText,
              parse_mode: 'HTML',
            }),
          });
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if this is a set-webhook request via query param or body
    const isSetWebhook = url.searchParams.get('action') === 'set-webhook';
    if (isSetWebhook) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot?mode=webhook`;
      
      const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Check if this is a webhook call from Telegram
    const isWebhookMode = url.searchParams.get('mode') === 'webhook';
    if (isWebhookMode) {
      const update = await req.json();
      console.log('Telegram update received:', JSON.stringify(update));
      
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const firstName = update.message.from?.first_name || 'Foydalanuvchi';
        
        if (text === '/start') {
          const responseText = `👋 Salom, ${firstName}!\n\n` +
            `🤖 BAREL.uz Telegram botiga xush kelibsiz!\n\n` +
            `📋 Sizning Chat ID: <code>${chatId}</code>\n\n` +
            `👆 Ushbu raqamni nusxalab, BAREL.uz dashboardidagi Telegram sozlamalariga kiriting.\n\n` +
            `✅ Shundan so'ng siz kunlik hisobotlar va bildirishnomalarni olishingiz mumkin bo'ladi.`;
          
          await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText,
              parse_mode: 'HTML',
            }),
          });
        } else if (text === '/help') {
          const helpText = `📖 <b>BAREL.uz Bot Yordam</b>\n\n` +
            `/start - Chat ID ni olish\n` +
            `/help - Yordam\n\n` +
            `🔗 Batafsil: barel.uz`;
          
          await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: helpText,
              parse_mode: 'HTML',
            }),
          });
        }
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API calls from frontend
    const body = await req.json();
    const { action, chat_id, message, parse_mode } = body;

    if (action === 'verify') {
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
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
