const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TELEGRAM_API = 'https://api.telegram.org/bot';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function sendMessage(botToken: string, chatId: string | number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sendPhoto(botToken: string, chatId: string | number, photoId: string, caption?: string) {
  await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoId, caption, parse_mode: 'HTML' }),
  });
}

async function getSession(supabase: any, chatId: string) {
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data;
}

async function upsertSession(supabase: any, chatId: string, updates: any) {
  await supabase
    .from('telegram_sessions')
    .upsert({
      chat_id: chatId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chat_id' });
}

async function deleteSession(supabase: any, chatId: string) {
  await supabase.from('telegram_sessions').delete().eq('chat_id', chatId);
}

// Authenticate operator against company_data in telegram_settings
async function authenticateOperator(supabase: any, login: string, password: string) {
  const { data: allSettings } = await supabase
    .from('telegram_settings')
    .select('company_key, chat_id, company_data')
    .eq('enabled', true);

  if (!allSettings) return null;

  for (const setting of allSettings) {
    const cd = setting.company_data;
    if (!cd || !cd.users) continue;
    const user = cd.users.find((u: any) => u.login === login && u.password === password);
    if (user) {
      return {
        user,
        companyKey: setting.company_key,
        bossChatId: setting.chat_id,
        fuelTypes: cd.fuelTypes || [],
        companyName: cd.companyName || '',
      };
    }
  }
  return null;
}

function makeButtons(labels: string[], prefix: string, columns = 2): any[][] {
  const rows: any[][] = [];
  let row: any[] = [];
  for (const l of labels) {
    row.push({ text: l, callback_data: `${prefix}_${l}` });
    if (row.length >= columns) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);

    // Set webhook
    if (url.searchParams.get('action') === 'set-webhook') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot?mode=webhook`;
      const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Webhook from Telegram
    if (url.searchParams.get('mode') === 'webhook') {
      const update = await req.json();
      console.log('Telegram update:', JSON.stringify(update));

      const supabase = getSupabase();

      // ===== CALLBACK QUERY (button presses) =====
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message.chat.id);
        const cbData = cb.data || '';

        await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: cb.id }),
        });

        const session = await getSession(supabase, cbChatId);
        const state = session?.state || 'IDLE';
        const sd = session?.data || {};

        // === FUEL TYPE SELECTION ===
        if (state === 'AWAITING_FUEL_TYPE') {
          if (cbData === 'fuel_done') {
            if (!sd.fuels || sd.fuels.length === 0) {
              await sendMessage(botToken, cbChatId, '❌ Kamida bitta yoqilg\'i tanlang!');
              return ok();
            }
            // Go to terminal
            await upsertSession(supabase, cbChatId, {
              state: 'AWAITING_TERMINAL',
              data: { ...sd, step: 'TERMINAL' },
            });
            await sendMessage(botToken, cbChatId, '💳 <b>Terminal summasini kiriting:</b>', {
              inline_keyboard: [
                [{ text: '✏️ Summa yozish', callback_data: 'term_custom' }],
                [{ text: '0️⃣ Terminal yo\'q', callback_data: 'term_0' }],
              ],
            });
            return ok();
          }

          const selectedFuel = cbData.replace('fuel_', '');
          await upsertSession(supabase, cbChatId, {
            state: 'AWAITING_END_VALUE',
            data: { ...sd, currentFuel: selectedFuel },
          });
          await sendMessage(botToken, cbChatId, `📊 <b>${selectedFuel}</b> - Oxirgi yangi ko'rsatkichni kiriting:`);
          return ok();
        }

        // === TERMINAL PRESET ===
        if (state === 'AWAITING_TERMINAL' && cbData.startsWith('term_')) {
          const val = cbData === 'term_custom' ? null : parseInt(cbData.replace('term_', ''));
          if (val !== null) {
            await upsertSession(supabase, cbChatId, {
              state: 'AWAITING_EXPENSES',
              data: { ...sd, terminal: val },
            });
            await showExpenseMenu(botToken, cbChatId, sd);
            return ok();
          }
          await upsertSession(supabase, cbChatId, {
            state: 'AWAITING_TERMINAL_CUSTOM',
            data: sd,
          });
          await sendMessage(botToken, cbChatId, '💳 Terminal summasini yozing (so\'m):');
          return ok();
        }

        // === EXPENSE TYPE ===
        if (state === 'AWAITING_EXPENSES' && cbData.startsWith('exp_')) {
          if (cbData === 'exp_done') {
            await upsertSession(supabase, cbChatId, {
              state: 'AWAITING_PHOTO_METER',
              data: { ...sd, step: 'PHOTO_METER' },
            });
            await sendMessage(botToken, cbChatId, '📸 <b>Hisoblagich rasmini yuboring:</b>');
            return ok();
          }
          if (cbData === 'exp_custom') {
            await upsertSession(supabase, cbChatId, {
              state: 'AWAITING_EXPENSE_CUSTOM',
              data: sd,
            });
            await sendMessage(botToken, cbChatId, '💸 Xarajat yozing: <i>"Sabab summa"</i>\nMasalan: Elektr 150000');
            return ok();
          }
          const reason = cbData.replace('exp_', '');
          await upsertSession(supabase, cbChatId, {
            state: 'AWAITING_EXPENSE_AMOUNT',
            data: { ...sd, currentExpReason: reason },
          });
          await sendMessage(botToken, cbChatId, `💸 <b>${reason}</b> uchun summa kiriting (so'm):`);
          return ok();
        }

        // === CONFIRMATION ===
        if (state === 'AWAITING_CONFIRMATION') {
          if (cbData === 'confirm_yes') {
            await sendReportToBoss(botToken, supabase, cbChatId, sd);
            return ok();
          }
          await upsertSession(supabase, cbChatId, {
            state: 'AUTHENTICATED',
            data: { login: sd.login, companyKey: sd.companyKey, bossChatId: sd.bossChatId, fuelTypes: sd.fuelTypes, companyName: sd.companyName },
          });
          await sendMessage(botToken, cbChatId, '❌ Bekor qilindi.', {
            inline_keyboard: [[{ text: '📊 Qaytadan kiritish', callback_data: 'menu_kiritish' }]],
          });
          return ok();
        }

        // === MENU ===
        if (cbData === 'menu_kiritish') {
          await startDataEntry(botToken, supabase, cbChatId, sd);
          return ok();
        }

        return ok();
      }

      // ===== MESSAGE =====
      if (update.message) {
        const chatId = String(update.message.chat.id);
        const text = (update.message.text || '').trim();
        const firstName = update.message.from?.first_name || 'Foydalanuvchi';
        const photo = update.message.photo;

        const session = await getSession(supabase, chatId);
        const state = session?.state || 'IDLE';
        const sd = session?.data || {};

        // /start
        if (text === '/start') {
          await deleteSession(supabase, chatId);
          await sendMessage(botToken, chatId,
            `👋 Salom, ${firstName}!\n\n🤖 BAREL.uz botiga xush kelibsiz!\n\n📋 Chat ID: <code>${chatId}</code>\n\n` +
            `👆 Boss: Bu raqamni dashboarddagi Telegram sozlamalariga kiriting.\n🔧 Operator: Quyidagi tugmani bosing.`,
            { inline_keyboard: [[{ text: '🔑 Kirish (Login)', callback_data: 'menu_login' }]] }
          );
          return ok();
        }

        // /cancel
        if (text === '/cancel' || text === '/chiqish') {
          await deleteSession(supabase, chatId);
          await sendMessage(botToken, chatId, '❌ Bekor qilindi.', {
            inline_keyboard: [[{ text: '🔑 Kirish', callback_data: 'menu_login' }]],
          });
          return ok();
        }

        // /login or menu_login callback
        if (text === '/login') {
          await upsertSession(supabase, chatId, { state: 'AWAITING_LOGIN', data: {} });
          await sendMessage(botToken, chatId, '👤 Loginingizni kiriting:');
          return ok();
        }

        // /kiritish shortcut
        if (text === '/kiritish' && (state === 'AUTHENTICATED' || state === 'MENU')) {
          await startDataEntry(botToken, supabase, chatId, sd);
          return ok();
        }

        // /help
        if (text === '/help') {
          await sendMessage(botToken, chatId, `📖 <b>Yordam</b>\n\n/start - Boshlash\n/login - Kirish\n/kiritish - Ma'lumot kiritish\n/cancel - Bekor qilish`);
          return ok();
        }

        // ===== STATE MACHINE =====

        // LOGIN
        if (state === 'AWAITING_LOGIN') {
          await upsertSession(supabase, chatId, { state: 'AWAITING_PASSWORD', data: { login: text } });
          await sendMessage(botToken, chatId, '🔑 Parolingizni kiriting:');
          return ok();
        }

        // PASSWORD - actual validation
        if (state === 'AWAITING_PASSWORD') {
          const authResult = await authenticateOperator(supabase, sd.login, text);
          if (!authResult) {
            await deleteSession(supabase, chatId);
            await sendMessage(botToken, chatId, '❌ Login yoki parol noto\'g\'ri!', {
              inline_keyboard: [[{ text: '🔄 Qaytadan kirish', callback_data: 'menu_login' }]],
            });
            return ok();
          }

          await upsertSession(supabase, chatId, {
            state: 'AUTHENTICATED',
            company_key: authResult.companyKey,
            user_login: authResult.user.login,
            data: {
              login: authResult.user.login,
              name: authResult.user.name,
              companyKey: authResult.companyKey,
              bossChatId: authResult.bossChatId,
              fuelTypes: authResult.fuelTypes,
              companyName: authResult.companyName,
            },
          });

          await sendMessage(botToken, chatId,
            `✅ Xush kelibsiz, <b>${authResult.user.name}</b>!\n🏢 ${authResult.companyName}`,
            { inline_keyboard: [[{ text: '📊 Ma\'lumot kiritish', callback_data: 'menu_kiritish' }]] }
          );
          return ok();
        }

        // END VALUE (number input)
        if (state === 'AWAITING_END_VALUE') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          await upsertSession(supabase, chatId, { state: 'AWAITING_PRICE', data: { ...sd, currentEnd: val } });
          await sendMessage(botToken, chatId, `💰 <b>${sd.currentFuel}</b> sotuv narxini kiriting (so'm):`);
          return ok();
        }

        // PRICE
        if (state === 'AWAITING_PRICE') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          await upsertSession(supabase, chatId, { state: 'AWAITING_PRIXOD', data: { ...sd, currentPrice: val } });
          await sendMessage(botToken, chatId,
            `📦 <b>${sd.currentFuel}</b> prixod miqdori:`,
            { inline_keyboard: [[{ text: '0️⃣ Prixod yo\'q', callback_data: 'prixod_0' }]] }
          );
          return ok();
        }

        // PRIXOD
        if (state === 'AWAITING_PRIXOD') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          await addFuelAndContinue(botToken, supabase, chatId, sd, val);
          return ok();
        }

        // TERMINAL custom
        if (state === 'AWAITING_TERMINAL_CUSTOM') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          await upsertSession(supabase, chatId, { state: 'AWAITING_EXPENSES', data: { ...sd, terminal: val } });
          await showExpenseMenu(botToken, chatId, sd);
          return ok();
        }

        // EXPENSE custom
        if (state === 'AWAITING_EXPENSE_CUSTOM') {
          const parts = text.match(/^(.+?)\s+(\d+)$/);
          if (!parts) { await sendMessage(botToken, chatId, '❌ Format: "Sabab 150000"'); return ok(); }
          const expense = { reason: parts[1].trim(), amount: parseInt(parts[2]) };
          const updatedExp = [...(sd.expenses || []), expense];
          await upsertSession(supabase, chatId, { state: 'AWAITING_EXPENSES', data: { ...sd, expenses: updatedExp } });
          await sendMessage(botToken, chatId, `✅ ${expense.reason}: ${expense.amount} so'm qo'shildi`);
          await showExpenseMenu(botToken, chatId, { ...sd, expenses: updatedExp });
          return ok();
        }

        // EXPENSE amount for preset
        if (state === 'AWAITING_EXPENSE_AMOUNT') {
          const val = parseInt(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const expense = { reason: sd.currentExpReason, amount: val };
          const updatedExp = [...(sd.expenses || []), expense];
          const newSd = { ...sd, expenses: updatedExp, currentExpReason: null };
          await upsertSession(supabase, chatId, { state: 'AWAITING_EXPENSES', data: newSd });
          await sendMessage(botToken, chatId, `✅ ${expense.reason}: ${val} so'm qo'shildi`);
          await showExpenseMenu(botToken, chatId, newSd);
          return ok();
        }

        // PHOTO METER
        if (state === 'AWAITING_PHOTO_METER') {
          if (!photo) { await sendMessage(botToken, chatId, '❌ Rasm yuboring!'); return ok(); }
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_PHOTO_TERMINAL',
            data: { ...sd, meterPhotoId: photo[photo.length - 1].file_id },
          });
          await sendMessage(botToken, chatId, '📸 <b>Terminal rasmini yuboring:</b>');
          return ok();
        }

        // PHOTO TERMINAL
        if (state === 'AWAITING_PHOTO_TERMINAL') {
          if (!photo) { await sendMessage(botToken, chatId, '❌ Rasm yuboring!'); return ok(); }
          const termPhotoId = photo[photo.length - 1].file_id;
          const newSd = { ...sd, terminalPhotoId: termPhotoId };

          // Build confirmation
          let summary = `📋 <b>TEKSHIRUV</b>\n\n📅 ${sd.date}\n🔧 ${sd.login}\n\n`;
          for (const f of (sd.fuels || [])) {
            summary += `⛽ ${f.type}: yangi=${f.end}, narx=${f.price}, prixod=${f.prixod}\n`;
          }
          summary += `\n💳 Terminal: ${sd.terminal || 0} so'm\n`;
          if ((sd.expenses || []).length > 0) {
            summary += '\n💸 Xarajatlar:\n';
            for (const e of sd.expenses) summary += `  • ${e.reason}: ${e.amount} so'm\n`;
          }

          await upsertSession(supabase, chatId, { state: 'AWAITING_CONFIRMATION', data: newSd });
          await sendMessage(botToken, chatId, summary, {
            inline_keyboard: [
              [{ text: '✅ Ha, to\'g\'ri', callback_data: 'confirm_yes' }, { text: '❌ Yo\'q', callback_data: 'confirm_no' }],
            ],
          });
          return ok();
        }

        // Default
        if (state === 'IDLE' || !state) {
          await sendMessage(botToken, chatId, '🤖 BAREL.uz Bot', {
            inline_keyboard: [
              [{ text: '🔑 Kirish', callback_data: 'menu_login' }],
              [{ text: '❓ Yordam', callback_data: 'menu_help' }],
            ],
          });
        }
      }

      // Handle menu_login callback separately
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message.chat.id);
        if (cb.data === 'menu_login') {
          await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
          await upsertSession(supabase, cbChatId, { state: 'AWAITING_LOGIN', data: {} });
          await sendMessage(botToken, cbChatId, '👤 Loginingizni kiriting:');
          return ok();
        }
        if (cb.data === 'prixod_0') {
          await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
          const session = await getSession(supabase, cbChatId);
          const sd = session?.data || {};
          await addFuelAndContinue(botToken, supabase, cbChatId, sd, 0);
          return ok();
        }
        if (cb.data === 'menu_help') {
          await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id }),
          });
          await sendMessage(botToken, cbChatId, `📖 <b>Yordam</b>\n\n/login - Kirish\n/kiritish - Ma'lumot kiritish\n/cancel - Bekor qilish`);
          return ok();
        }
      }

      return ok();
    }

    // ===== API calls from frontend =====
    const body = await req.json();
    const { action, chat_id, message, parse_mode } = body;

    if (action === 'set-webhook') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const webhookUrl = `${supabaseUrl}/functions/v1/telegram-bot?mode=webhook`;
      const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify') {
      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: '✅ BAREL.uz Telegram bot muvaffaqiyatli ulandi!', parse_mode: 'HTML' }),
      });
      const data = await res.json();
      if (!data.ok) {
        return new Response(JSON.stringify({ success: false, error: data.description || 'Chat ID noto\'g\'ri' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send') {
      if (!chat_id || !message) {
        return new Response(JSON.stringify({ error: 'chat_id and message required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: message, parse_mode: parse_mode || 'HTML' }),
      });
      const data = await res.json();
      if (!data.ok) {
        return new Response(JSON.stringify({ success: false, error: data.description }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'daily_report') {
      const { company_name, report_date, fuels, total_sales, total_expenses, net_profit, terminal: terminalVal, naqd_pul } = body;
      let text = `📊 <b>${company_name}</b>\n📅 Kunlik hisobot: <b>${report_date}</b>\n\n`;
      if (fuels && fuels.length > 0) {
        text += `⛽ <b>Yoqilg'i sotuvi:</b>\n`;
        for (const f of fuels) text += `  • ${f.type}: ${f.sold} ${f.unit} × ${f.price} = ${f.total} so'm\n`;
        text += '\n';
      }
      text += `💰 Jami sotuv: <b>${total_sales} so'm</b>\n`;
      if (terminalVal) text += `💳 Terminal: <b>${terminalVal} so'm</b>\n`;
      text += `📉 Xarajatlar: <b>${total_expenses} so'm</b>\n`;
      text += `📈 Sof foyda: <b>${net_profit} so'm</b>\n`;
      if (naqd_pul) text += `💵 Naqd pul: <b>${naqd_pul} so'm</b>\n`;
      text += `\n🤖 BAREL.uz avtomatik hisobot`;

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ success: data.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ===== HELPER FUNCTIONS =====

function ok() {
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function startDataEntry(botToken: string, supabase: any, chatId: string, sd: any) {
  const fuelTypes = sd.fuelTypes || ['Propan', 'AI-91', 'AI-92', 'AI-95', 'Dizel', 'Metan'];
  const buttons = fuelTypes.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `fuel_${ft}` }]);
  buttons.push([{ text: '✅ Tayyor', callback_data: 'fuel_done' }]);

  await upsertSession(supabase, chatId, {
    state: 'AWAITING_FUEL_TYPE',
    data: {
      ...sd,
      fuels: [],
      expenses: [],
      terminal: 0,
      date: new Date().toISOString().split('T')[0],
    },
  });
  await sendMessage(botToken, chatId, '⛽ <b>Yoqilg\'i turini tanlang:</b>', { inline_keyboard: buttons });
}

async function addFuelAndContinue(botToken: string, supabase: any, chatId: string, sd: any, prixod: number) {
  const fuelEntry = { type: sd.currentFuel, end: sd.currentEnd, price: sd.currentPrice, prixod };
  const updatedFuels = [...(sd.fuels || []), fuelEntry];

  // If prixod > 0, notify boss
  if (prixod > 0 && sd.bossChatId) {
    await sendMessage(botToken, sd.bossChatId,
      `📦 <b>Prixod xabari</b>\n\n🔧 Operator: ${sd.login}\n⛽ ${sd.currentFuel}: ${prixod}\n\n❓ <b>Tannarxi qancha so'mdan keldi?</b>`
    );
  }

  const fuelTypes = sd.fuelTypes || ['Propan', 'AI-91', 'AI-92', 'AI-95', 'Dizel', 'Metan'];
  const addedTypes = updatedFuels.map((f: any) => f.type);
  const remaining = fuelTypes.filter((ft: string) => !addedTypes.includes(ft));
  const buttons = remaining.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `fuel_${ft}` }]);
  buttons.push([{ text: '✅ Tayyor', callback_data: 'fuel_done' }]);

  const newSd = { ...sd, fuels: updatedFuels, currentFuel: null, currentEnd: null, currentPrice: null };
  await upsertSession(supabase, chatId, { state: 'AWAITING_FUEL_TYPE', data: newSd });
  await sendMessage(botToken, chatId, `✅ <b>${fuelEntry.type}</b> qo'shildi!\n\n⛽ Keyingisini tanlang:`, { inline_keyboard: buttons });
}

async function showExpenseMenu(botToken: string, chatId: string, sd: any) {
  const presets = ['Elektr', 'Gaz', 'Suv', 'Ish haqi', 'Transport'];
  const buttons = presets.map(p => [{ text: `💸 ${p}`, callback_data: `exp_${p}` }]);
  buttons.push([{ text: '✏️ Boshqa xarajat', callback_data: 'exp_custom' }]);
  buttons.push([{ text: '✅ Xarajat yo\'q / Tayyor', callback_data: 'exp_done' }]);

  const expCount = (sd.expenses || []).length;
  const msg = expCount > 0
    ? `💸 <b>${expCount} ta xarajat kiritildi.</b>\nYana qo'shing yoki Tayyor bosing:`
    : '💸 <b>Xarajat bormi?</b>';
  await sendMessage(botToken, chatId, msg, { inline_keyboard: buttons });
}

async function sendReportToBoss(botToken: string, supabase: any, chatId: string, sd: any) {
  const bossChatId = sd.bossChatId;
  if (!bossChatId) {
    await sendMessage(botToken, chatId, '⚠️ Boss Chat ID topilmadi!');
    return;
  }

  // 1. PHOTOS FIRST
  if (sd.meterPhotoId) {
    await sendPhoto(botToken, bossChatId, sd.meterPhotoId, `📸 Hisoblagich - ${sd.login} (${sd.date})`);
  }
  if (sd.terminalPhotoId) {
    await sendPhoto(botToken, bossChatId, sd.terminalPhotoId, `📸 Terminal - ${sd.login} (${sd.date})`);
  }

  // 2. REPORT TEXT
  const fuels = sd.fuels || [];
  const expenses = sd.expenses || [];
  const terminalVal = sd.terminal || 0;

  let totalSales = 0;
  let report = `📊 <b>OPERATOR HISOBOTI</b>\n\n📅 ${sd.date}\n🔧 ${sd.name || sd.login}\n🏢 ${sd.companyName || ''}\n\n`;

  if (fuels.length > 0) {
    report += `⛽ <b>Sotilgan yoqilg'i:</b>\n`;
    for (const f of fuels) {
      report += `  • ${f.type}: yangi=${f.end}, narx=${f.price} so'm`;
      if (f.prixod > 0) report += `, prixod=${f.prixod}`;
      report += '\n';
    }
    report += '\n';
  }

  let totalExp = 0;
  if (expenses.length > 0) {
    report += `💸 <b>Xarajatlar:</b>\n`;
    for (const e of expenses) {
      report += `  • ${e.reason}: ${e.amount} so'm\n`;
      totalExp += e.amount;
    }
    report += `📉 Jami xarajat: ${totalExp} so'm\n\n`;
  }

  report += `💳 Terminal: ${terminalVal} so'm\n`;
  report += `\n✅ Operator tasdiqladi\n🤖 BAREL.uz`;

  await sendMessage(botToken, bossChatId, report);

  // Reset session
  await upsertSession(supabase, chatId, {
    state: 'AUTHENTICATED',
    data: { login: sd.login, companyKey: sd.companyKey, bossChatId: sd.bossChatId, fuelTypes: sd.fuelTypes, companyName: sd.companyName, name: sd.name },
  });
  await sendMessage(botToken, chatId, '✅ Ma\'lumotlar Boss ga yuborildi!', {
    inline_keyboard: [[{ text: '📊 Yangi kiritish', callback_data: 'menu_kiritish' }]],
  });
}
