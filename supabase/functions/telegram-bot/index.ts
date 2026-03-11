const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TELEGRAM_API = 'https://api.telegram.org/bot';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getSupabase() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function sendMessage(botToken: string, chatId: string | number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function sendPhoto(botToken: string, chatId: string | number, photoId: string, caption?: string) {
  await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoId, caption, parse_mode: 'HTML' }),
  });
}

async function getSession(supabase: any, chatId: string) {
  const { data } = await supabase.from('telegram_sessions').select('*').eq('chat_id', chatId).maybeSingle();
  return data;
}

async function upsertSession(supabase: any, chatId: string, updates: any) {
  await supabase.from('telegram_sessions').upsert({ chat_id: chatId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });
}

async function deleteSession(supabase: any, chatId: string) {
  await supabase.from('telegram_sessions').delete().eq('chat_id', chatId);
}

async function authenticateUser(supabase: any, login: string, password: string) {
  const { data: users } = await supabase.from('company_users').select('*').eq('login', login).eq('password', password).limit(1);
  if (!users || users.length === 0) return null;
  const user = users[0];

  const { data: setting } = await supabase.from('telegram_settings').select('chat_id, company_data').eq('company_key', user.company_key).eq('enabled', true).maybeSingle();
  const cd = setting?.company_data || {};

  return {
    user: { login: user.login, name: user.name, role: user.role },
    companyKey: user.company_key,
    companyName: user.company_name || cd.companyName || '',
    bossChatId: setting?.chat_id || '',
    fuelTypes: cd.fuelTypes || [],
    stations: cd.stations || [],
    stationIndex: cd.stationIndex ?? 0,
  };
}

function numFmt(n: number): string {
  return n.toLocaleString('uz-UZ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) return new Response(JSON.stringify({ error: 'Bot token not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);

    // Set webhook
    if (url.searchParams.get('action') === 'set-webhook') {
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot?mode=webhook`;
      const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: webhookUrl }) });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Webhook from Telegram
    if (url.searchParams.get('mode') === 'webhook') {
      const update = await req.json();
      console.log('Telegram update:', JSON.stringify(update));
      const supabase = getSupabase();

      // ===== CALLBACK QUERY =====
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message.chat.id);
        const cbData = cb.data || '';
        await fetch(`${TELEGRAM_API}${botToken}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id }) });

        const session = await getSession(supabase, cbChatId);
        const state = session?.state || 'IDLE';
        const sd = session?.data || {};

        // === FUEL TYPE SELECTION ===
        if (state === 'AWAITING_FUEL_TYPE') {
          if (cbData === 'fuel_done') {
            if (!sd.fuels || sd.fuels.length === 0) { await sendMessage(botToken, cbChatId, "❌ Kamida bitta yoqilg'i tanlang!"); return ok(); }
            // Ask for each fuel price
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_FUEL_PRICE_ALL', data: { ...sd, priceIdx: 0 } });
            await sendMessage(botToken, cbChatId, `💰 <b>${sd.fuels[0].type}</b> sotuv narxini kiriting (so'm):`);
            return ok();
          }
          const selectedFuel = cbData.replace('fuel_', '');
          await upsertSession(supabase, cbChatId, { state: 'AWAITING_END_VALUE', data: { ...sd, currentFuel: selectedFuel } });
          await sendMessage(botToken, cbChatId, `📊 <b>${selectedFuel}</b> — Oxirgi yangi ko'rsatkichni kiriting:`);
          return ok();
        }

        // === TERMINAL PRESET ===
        if (state === 'AWAITING_TERMINAL' && cbData.startsWith('term_')) {
          const val = cbData === 'term_custom' ? null : parseInt(cbData.replace('term_', ''));
          if (val !== null) {
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_EXPENSES', data: { ...sd, terminal: val } });
            await showExpenseMenu(botToken, cbChatId, sd);
            return ok();
          }
          await upsertSession(supabase, cbChatId, { state: 'AWAITING_TERMINAL_CUSTOM', data: sd });
          await sendMessage(botToken, cbChatId, "💳 Terminal summasini yozing (so'm):");
          return ok();
        }

        // === EXPENSE TYPE ===
        if (state === 'AWAITING_EXPENSES' && cbData.startsWith('exp_')) {
          if (cbData === 'exp_done') {
            // Ask about prixod (incoming stock)
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_PRIXOD_QUESTION', data: sd });
            await sendMessage(botToken, cbChatId, "📦 <b>Bugun kirim (prixod) bo'ldimi?</b>", {
              inline_keyboard: [
                [{ text: "✅ Ha", callback_data: 'prixod_yes' }, { text: "❌ Yo'q", callback_data: 'prixod_no' }],
              ],
            });
            return ok();
          }
          if (cbData === 'exp_custom') {
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_EXPENSE_CUSTOM', data: sd });
            await sendMessage(botToken, cbChatId, "💸 Xarajat yozing: <i>\"Sabab summa\"</i>\nMasalan: Suv 10000");
            return ok();
          }
          const reason = cbData.replace('exp_', '');
          await upsertSession(supabase, cbChatId, { state: 'AWAITING_EXPENSE_AMOUNT', data: { ...sd, currentExpReason: reason } });
          await sendMessage(botToken, cbChatId, `💸 <b>${reason}</b> uchun summa kiriting (so'm):`);
          return ok();
        }

        // === PRIXOD QUESTION ===
        if (state === 'AWAITING_PRIXOD_QUESTION') {
          if (cbData === 'prixod_no') {
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_PHOTO_METER', data: sd });
            await sendMessage(botToken, cbChatId, "📸 <b>Hisoblagich rasmini yuboring:</b>");
            return ok();
          }
          if (cbData === 'prixod_yes') {
            const fuelTypes = sd.fuelTypes || [];
            const buttons = fuelTypes.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `prixod_fuel_${ft}` }]);
            buttons.push([{ text: '✅ Tayyor', callback_data: 'prixod_fuel_done' }]);
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_PRIXOD_FUEL', data: { ...sd, prixodItems: [] } });
            await sendMessage(botToken, cbChatId, "📦 Qaysi mahsulotga prixod bo'ldi?", { inline_keyboard: buttons });
            return ok();
          }
        }

        // === PRIXOD FUEL SELECT ===
        if (state === 'AWAITING_PRIXOD_FUEL') {
          if (cbData === 'prixod_fuel_done') {
            // Notify boss about prixods
            if (sd.bossChatId && (sd.prixodItems || []).length > 0) {
              let msg = `📦 <b>PRIXOD XABARI</b>\n\n🔧 Operator: ${sd.name || sd.login}\n🏢 ${sd.companyName}\n\n`;
              for (const p of sd.prixodItems) msg += `⛽ ${p.fuel}: ${numFmt(p.amount)} L\n`;
              msg += `\n❓ <b>Tannarxini kiriting</b>`;
              await sendMessage(botToken, sd.bossChatId, msg);
            }
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_PHOTO_METER', data: sd });
            await sendMessage(botToken, cbChatId, "📸 <b>Hisoblagich rasmini yuboring:</b>");
            return ok();
          }
          const fuel = cbData.replace('prixod_fuel_', '');
          await upsertSession(supabase, cbChatId, { state: 'AWAITING_PRIXOD_AMOUNT', data: { ...sd, currentPrixodFuel: fuel } });
          await sendMessage(botToken, cbChatId, `📦 <b>${fuel}</b> uchun prixod miqdorini kiriting (L):`);
          return ok();
        }

        // === PRIXOD CALLBACK FOR FUEL ENTRY (0) ===
        if (cbData === 'prixod_0') {
          await addFuelAndContinue(botToken, supabase, cbChatId, sd, 0);
          return ok();
        }

        // === CONFIRMATION ===
        if (state === 'AWAITING_CONFIRMATION') {
          if (cbData === 'confirm_yes') {
            // Mark as confirmed, start 15-min edit window
            const newSd = { ...sd, confirmedAt: new Date().toISOString() };
            await sendReportToBoss(botToken, supabase, cbChatId, newSd);
            return ok();
          }
          if (cbData === 'confirm_edit') {
            // Allow editing within 15 min
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_EDIT_CHOICE', data: sd });
            await sendMessage(botToken, cbChatId, "✏️ Nimani tahrirlaysiz?", {
              inline_keyboard: [
                [{ text: "⛽ Hisoblagich", callback_data: 'edit_fuels' }],
                [{ text: "💳 Terminal", callback_data: 'edit_terminal' }],
                [{ text: "💸 Xarajatlar", callback_data: 'edit_expenses' }],
                [{ text: "❌ Bekor", callback_data: 'confirm_cancel' }],
              ],
            });
            return ok();
          }
          if (cbData === 'confirm_no') {
            await upsertSession(supabase, cbChatId, {
              state: 'AUTHENTICATED',
              data: { login: sd.login, companyKey: sd.companyKey, bossChatId: sd.bossChatId, fuelTypes: sd.fuelTypes, companyName: sd.companyName, name: sd.name, role: sd.role, stations: sd.stations },
            });
            await sendMessage(botToken, cbChatId, '❌ Bekor qilindi.', { inline_keyboard: [[{ text: "📊 Qaytadan kiritish", callback_data: 'menu_kiritish' }]] });
            return ok();
          }
        }

        // === EDIT CHOICE ===
        if (state === 'AWAITING_EDIT_CHOICE') {
          if (cbData === 'edit_terminal') {
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_TERMINAL_CUSTOM', data: sd });
            await sendMessage(botToken, cbChatId, "💳 Yangi terminal summasini kiriting:");
            return ok();
          }
          if (cbData === 'edit_expenses') {
            await upsertSession(supabase, cbChatId, { state: 'AWAITING_EXPENSES', data: { ...sd, expenses: [] } });
            await showExpenseMenu(botToken, cbChatId, { ...sd, expenses: [] });
            return ok();
          }
          if (cbData === 'confirm_cancel') {
            await showConfirmation(botToken, supabase, cbChatId, sd);
            return ok();
          }
        }

        // === BOSS MENU CALLBACKS ===
        if (cbData === 'boss_foyda' || cbData === 'boss_savdo' || cbData === 'boss_xarajat' || cbData === 'boss_ombor') {
          const type = cbData.replace('boss_', '');
          const stations = sd.stations || ['Zapravka 1'];
          const buttons = stations.map((s: string, i: number) => [{ text: `🏢 ${s}`, callback_data: `boss_station_${type}_${i}` }]);
          buttons.push([{ text: "📊 Hammasi", callback_data: `boss_station_${type}_all` }]);
          await upsertSession(supabase, cbChatId, { state: `BOSS_${type.toUpperCase()}_STATION`, data: sd });
          await sendMessage(botToken, cbChatId, "🏢 Zapravkani tanlang:", { inline_keyboard: buttons });
          return ok();
        }

        // === BOSS STATION SELECTION ===
        if (cbData.startsWith('boss_station_')) {
          const parts = cbData.replace('boss_station_', '').split('_');
          const type = parts[0]; // foyda, savdo, xarajat, ombor
          const stationPart = parts.slice(1).join('_');
          const stationFilter = stationPart === 'all' ? 'all' : parseInt(stationPart);
          
          await upsertSession(supabase, cbChatId, { state: 'BOSS_DATE_RANGE', data: { ...sd, bossType: type, bossStation: stationFilter } });
          await sendMessage(botToken, cbChatId, type === 'ombor' 
            ? "📦 Ombor ma'lumotlari yuklanmoqda..."
            : "📅 Sana oralig'ini tanlang:", {
            inline_keyboard: type === 'ombor' ? [] : [
              [{ text: "📅 Bugun", callback_data: 'boss_date_today' }],
              [{ text: "📅 Kecha", callback_data: 'boss_date_yesterday' }],
              [{ text: "📅 Hafta", callback_data: 'boss_date_week' }],
              [{ text: "📅 Oy", callback_data: 'boss_date_month' }],
            ],
          });
          
          if (type === 'ombor') {
            // Show inventory immediately
            await sendMessage(botToken, cbChatId, `📦 <b>OMBOR HOLATI</b>\n\n🏢 ${stationFilter === 'all' ? 'Barcha zapravkalar' : (sd.stations || [])[stationFilter as number] || 'Zapravka'}\n\n⚠️ Ombor ma'lumotlari web-saytda mavjud.\nOmbor qoldig'ini web-saytdan tekshiring.`);
          }
          return ok();
        }

        // === BOSS DATE RANGE ===
        if (state === 'BOSS_DATE_RANGE' && cbData.startsWith('boss_date_')) {
          const range = cbData.replace('boss_date_', '');
          const now = new Date();
          let fromDate = '', toDate = now.toISOString().split('T')[0];
          if (range === 'today') fromDate = toDate;
          else if (range === 'yesterday') { const y = new Date(now.getTime() - 86400000); fromDate = toDate = y.toISOString().split('T')[0]; }
          else if (range === 'week') { const w = new Date(now.getTime() - 7 * 86400000); fromDate = w.toISOString().split('T')[0]; }
          else if (range === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); fromDate = m.toISOString().split('T')[0]; }
          
          const type = sd.bossType;
          const station = sd.bossStation;
          
          let msg = `📊 <b>${type === 'foyda' ? 'FOYDA' : type === 'savdo' ? 'SOTUV' : 'XARAJATLAR'} HISOBOTI</b>\n\n`;
          msg += `📅 ${fromDate} — ${toDate}\n`;
          msg += `🏢 ${station === 'all' ? 'Barcha zapravkalar' : (sd.stations || [])[station] || 'Zapravka'}\n\n`;
          msg += `⚠️ Batafsil ma'lumotlar web-saytda mavjud.\nhttps://barel.lovable.app`;
          
          await sendMessage(botToken, cbChatId, msg);
          
          // Return to boss menu
          await sendMessage(botToken, cbChatId, "📋 Yana nima ko'rmoqchisiz?", {
            inline_keyboard: [
              [{ text: "💰 Foydani ko'rish", callback_data: 'boss_foyda' }],
              [{ text: "📊 Savdoni ko'rish", callback_data: 'boss_savdo' }],
              [{ text: "💸 Xarajatlarni ko'rish", callback_data: 'boss_xarajat' }],
              [{ text: "📦 Omborni ko'rish", callback_data: 'boss_ombor' }],
            ],
          });
          return ok();
        }

        // === OMBORCHI CALLBACKS ===
        if (cbData === 'omborchi_ombor') {
          const stations = sd.stations || ['Zapravka 1'];
          const buttons = stations.map((s: string, i: number) => [{ text: `🏢 ${s}`, callback_data: `omborchi_view_${i}` }]);
          await sendMessage(botToken, cbChatId, "📦 Qaysi zapravkani ko'rmoqchisiz?", { inline_keyboard: buttons });
          return ok();
        }
        if (cbData.startsWith('omborchi_view_')) {
          const idx = parseInt(cbData.replace('omborchi_view_', ''));
          const stationName = (sd.stations || [])[idx] || 'Zapravka';
          await sendMessage(botToken, cbChatId, `📦 <b>${stationName} — OMBOR</b>\n\n⚠️ Ombor qoldig'ini web-saytdan tekshiring.\nhttps://barel.lovable.app`);
          return ok();
        }
        if (cbData === 'omborchi_plomba') {
          await sendMessage(botToken, cbChatId, "🔒 <b>PLOMBA BOSHQARUVI</b>\n\nPlomba qo'shish yoki o'chirish uchun web-saytga kiring:\nhttps://barel.lovable.app");
          return ok();
        }

        // === MENU CALLBACKS ===
        if (cbData === 'menu_kiritish') { await startDataEntry(botToken, supabase, cbChatId, sd); return ok(); }
        if (cbData === 'menu_login') { await upsertSession(supabase, cbChatId, { state: 'AWAITING_LOGIN', data: {} }); await sendMessage(botToken, cbChatId, '👤 Loginingizni kiriting:'); return ok(); }
        if (cbData === 'menu_help') { await sendMessage(botToken, cbChatId, "📖 <b>Yordam</b>\n\n/login - Kirish\n/kiritish - Ma'lumot kiritish\n/cancel - Bekor qilish"); return ok(); }

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
          // Check if already authenticated (boss who set chat_id)
          await sendMessage(botToken, chatId,
            `👋 Salom, ${firstName}!\n\n🤖 <b>BAREL.uz</b> botiga xush kelibsiz!\n\n📋 Chat ID: <code>${chatId}</code>\n\n👆 Boss: Bu raqamni Telegram sozlamalariga kiriting.\n🔧 Operator/Omborchi: Quyidagi tugmani bosing.`,
            { inline_keyboard: [[{ text: '🔑 Kirish (Login)', callback_data: 'menu_login' }]] }
          );
          return ok();
        }

        if (text === '/cancel' || text === '/chiqish') {
          await deleteSession(supabase, chatId);
          await sendMessage(botToken, chatId, '❌ Bekor qilindi.', { inline_keyboard: [[{ text: '🔑 Kirish', callback_data: 'menu_login' }]] });
          return ok();
        }

        if (text === '/login') { await upsertSession(supabase, chatId, { state: 'AWAITING_LOGIN', data: {} }); await sendMessage(botToken, chatId, '👤 Loginingizni kiriting:'); return ok(); }
        if (text === '/kiritish' && (state === 'AUTHENTICATED' || state === 'MENU')) { await startDataEntry(botToken, supabase, chatId, sd); return ok(); }
        if (text === '/help') { await sendMessage(botToken, chatId, "📖 <b>Yordam</b>\n\n/start - Boshlash\n/login - Kirish\n/kiritish - Ma'lumot kiritish\n/cancel - Bekor qilish"); return ok(); }

        // ===== STATE MACHINE =====

        if (state === 'AWAITING_LOGIN') {
          await upsertSession(supabase, chatId, { state: 'AWAITING_PASSWORD', data: { login: text } });
          await sendMessage(botToken, chatId, '🔑 Parolingizni kiriting:');
          return ok();
        }

        if (state === 'AWAITING_PASSWORD') {
          const authResult = await authenticateUser(supabase, sd.login, text);
          if (!authResult) {
            await deleteSession(supabase, chatId);
            await sendMessage(botToken, chatId, "❌ Login yoki parol noto'g'ri!", { inline_keyboard: [[{ text: '🔄 Qaytadan kirish', callback_data: 'menu_login' }]] });
            return ok();
          }

          const sessionData = {
            login: authResult.user.login,
            name: authResult.user.name,
            role: authResult.user.role,
            companyKey: authResult.companyKey,
            bossChatId: authResult.bossChatId,
            fuelTypes: authResult.fuelTypes,
            companyName: authResult.companyName,
            stations: authResult.stations,
            stationIndex: authResult.stationIndex,
          };

          await upsertSession(supabase, chatId, {
            state: 'AUTHENTICATED',
            company_key: authResult.companyKey,
            user_login: authResult.user.login,
            data: sessionData,
          });

          const role = authResult.user.role;
          const stationName = (authResult.stations || [])[authResult.stationIndex] || authResult.companyName;

          if (role === 'BOSS') {
            await sendMessage(botToken, chatId,
              `✅ Xush kelibsiz, <b>${authResult.user.name}</b>!\n🏢 ${authResult.companyName}\n👑 Boss`,
              { inline_keyboard: [
                [{ text: "💰 Foydani ko'rish", callback_data: 'boss_foyda' }],
                [{ text: "📊 Savdoni ko'rish", callback_data: 'boss_savdo' }],
                [{ text: "💸 Xarajatlarni ko'rish", callback_data: 'boss_xarajat' }],
                [{ text: "📦 Omborni ko'rish", callback_data: 'boss_ombor' }],
              ]}
            );
          } else if (role === 'OMBORCHI') {
            await sendMessage(botToken, chatId,
              `✅ Xush kelibsiz, <b>${authResult.user.name}</b>!\n🏢 ${authResult.companyName}\n📦 Ombor nazoratchisi`,
              { inline_keyboard: [
                [{ text: "📦 Omborni ko'rish", callback_data: 'omborchi_ombor' }],
                [{ text: "🔒 Plomba", callback_data: 'omborchi_plomba' }],
              ]}
            );
          } else {
            // OPERATOR
            await sendMessage(botToken, chatId,
              `✅ Xush kelibsiz, <b>${authResult.user.name}</b>!\n⛽ Siz <b>${stationName}</b> zapravkasiga kirdingiz.`,
              { inline_keyboard: [[{ text: "📊 Ma'lumot kiritish", callback_data: 'menu_kiritish' }]] }
            );
          }
          return ok();
        }

        // END VALUE
        if (state === 'AWAITING_END_VALUE') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }

          // Check if this is first time (no previous data) - ask for initial start meter
          if (!sd.initialStartSet && !sd.startValues) {
            await upsertSession(supabase, chatId, { state: 'AWAITING_START_VALUE', data: { ...sd, currentEnd: val } });
            await sendMessage(botToken, chatId, `📊 <b>${sd.currentFuel}</b> — Boshlang'ich hisoblagich (start) qiymatini kiriting:`);
            return ok();
          }

          // Normal flow - just save end and ask for prixod
          await upsertSession(supabase, chatId, { state: 'AWAITING_PRIXOD', data: { ...sd, currentEnd: val } });
          await sendMessage(botToken, chatId, `📦 <b>${sd.currentFuel}</b> prixod miqdori:`, {
            inline_keyboard: [[{ text: "0️⃣ Prixod yo'q", callback_data: 'prixod_0' }]],
          });
          return ok();
        }

        // START VALUE (first time only)
        if (state === 'AWAITING_START_VALUE') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const startValues = { ...(sd.startValues || {}), [sd.currentFuel]: val };
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_INITIAL_STOCK',
            data: { ...sd, startValues, currentStart: val },
          });
          await sendMessage(botToken, chatId, `📦 <b>${sd.currentFuel}</b> — Boshlang'ich qoldiq (ombordagi miqdor) kiriting:`);
          return ok();
        }

        // INITIAL STOCK (first time only)
        if (state === 'AWAITING_INITIAL_STOCK') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const newSd = { ...sd, initialStartSet: true };
          await upsertSession(supabase, chatId, { state: 'AWAITING_PRIXOD', data: newSd });
          await sendMessage(botToken, chatId, `📦 <b>${sd.currentFuel}</b> prixod miqdori:`, {
            inline_keyboard: [[{ text: "0️⃣ Prixod yo'q", callback_data: 'prixod_0' }]],
          });
          return ok();
        }

        // FUEL PRICE (all fuels one by one)
        if (state === 'AWAITING_FUEL_PRICE_ALL') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const fuels = sd.fuels || [];
          const idx = sd.priceIdx || 0;
          fuels[idx] = { ...fuels[idx], price: val };
          
          if (idx + 1 < fuels.length) {
            await upsertSession(supabase, cbChatId || chatId, { state: 'AWAITING_FUEL_PRICE_ALL', data: { ...sd, fuels, priceIdx: idx + 1 } });
            await sendMessage(botToken, chatId, `💰 <b>${fuels[idx + 1].type}</b> sotuv narxini kiriting (so'm):`);
          } else {
            // All prices collected, go to terminal
            await upsertSession(supabase, chatId, { state: 'AWAITING_TERMINAL', data: { ...sd, fuels } });
            await sendMessage(botToken, chatId, "💳 <b>Terminal summasini kiriting:</b>", {
              inline_keyboard: [
                [{ text: "✏️ Summa yozish", callback_data: 'term_custom' }],
                [{ text: "0️⃣ Terminal yo'q", callback_data: 'term_0' }],
              ],
            });
          }
          return ok();
        }

        // PRIXOD
        if (state === 'AWAITING_PRIXOD') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          await addFuelAndContinue(botToken, supabase, chatId, sd, val);
          return ok();
        }

        // PRIXOD AMOUNT
        if (state === 'AWAITING_PRIXOD_AMOUNT') {
          const val = parseFloat(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const prixodItems = [...(sd.prixodItems || []), { fuel: sd.currentPrixodFuel, amount: val }];
          const fuelTypes = sd.fuelTypes || [];
          const buttons = fuelTypes.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `prixod_fuel_${ft}` }]);
          buttons.push([{ text: '✅ Tayyor', callback_data: 'prixod_fuel_done' }]);
          await upsertSession(supabase, chatId, { state: 'AWAITING_PRIXOD_FUEL', data: { ...sd, prixodItems, currentPrixodFuel: null } });
          await sendMessage(botToken, chatId, `✅ ${sd.currentPrixodFuel}: ${numFmt(val)} L qo'shildi\n\nYana prixod bormi?`, { inline_keyboard: buttons });
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
          await sendMessage(botToken, chatId, `✅ ${expense.reason}: ${numFmt(expense.amount)} so'm qo'shildi`);
          await showExpenseMenu(botToken, chatId, { ...sd, expenses: updatedExp });
          return ok();
        }

        // EXPENSE amount
        if (state === 'AWAITING_EXPENSE_AMOUNT') {
          const val = parseInt(text);
          if (isNaN(val)) { await sendMessage(botToken, chatId, '❌ Raqam kiriting!'); return ok(); }
          const expense = { reason: sd.currentExpReason, amount: val };
          const updatedExp = [...(sd.expenses || []), expense];
          const newSd = { ...sd, expenses: updatedExp, currentExpReason: null };
          await upsertSession(supabase, chatId, { state: 'AWAITING_EXPENSES', data: newSd });
          await sendMessage(botToken, chatId, `✅ ${expense.reason}: ${numFmt(val)} so'm qo'shildi`);
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
          await sendMessage(botToken, chatId, "📸 <b>Terminal chek rasmini yuboring:</b>");
          return ok();
        }

        // PHOTO TERMINAL
        if (state === 'AWAITING_PHOTO_TERMINAL') {
          if (!photo) { await sendMessage(botToken, chatId, '❌ Rasm yuboring!'); return ok(); }
          const newSd = { ...sd, terminalPhotoId: photo[photo.length - 1].file_id };
          await showConfirmation(botToken, supabase, chatId, newSd);
          return ok();
        }

        // Default
        if (state === 'AUTHENTICATED') {
          const role = sd.role || 'OPERATOR';
          if (role === 'BOSS') {
            await sendMessage(botToken, chatId, "📋 Quyidagi tugmalardan foydalaning:", {
              inline_keyboard: [
                [{ text: "💰 Foydani ko'rish", callback_data: 'boss_foyda' }],
                [{ text: "📊 Savdoni ko'rish", callback_data: 'boss_savdo' }],
                [{ text: "💸 Xarajatlarni ko'rish", callback_data: 'boss_xarajat' }],
                [{ text: "📦 Omborni ko'rish", callback_data: 'boss_ombor' }],
              ],
            });
          } else if (role === 'OMBORCHI') {
            await sendMessage(botToken, chatId, "📋 Quyidagi tugmalardan foydalaning:", {
              inline_keyboard: [
                [{ text: "📦 Omborni ko'rish", callback_data: 'omborchi_ombor' }],
                [{ text: "🔒 Plomba", callback_data: 'omborchi_plomba' }],
              ],
            });
          } else {
            await sendMessage(botToken, chatId, "📋 Quyidagi tugmani bosing:", {
              inline_keyboard: [[{ text: "📊 Ma'lumot kiritish", callback_data: 'menu_kiritish' }]],
            });
          }
          return ok();
        }

        if (state === 'IDLE' || !state) {
          await sendMessage(botToken, chatId, '🤖 BAREL.uz Bot', {
            inline_keyboard: [[{ text: '🔑 Kirish', callback_data: 'menu_login' }], [{ text: '❓ Yordam', callback_data: 'menu_help' }]],
          });
        }
      }

      return ok();
    }

    // ===== API calls from frontend =====
    const body = await req.json();
    const { action, chat_id, message, parse_mode } = body;

    if (action === 'set-webhook') {
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot?mode=webhook`;
      const res = await fetch(`${TELEGRAM_API}${botToken}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: webhookUrl }) });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify') {
      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: "✅ BAREL.uz Telegram bot muvaffaqiyatli ulandi!", parse_mode: 'HTML' }),
      });
      const data = await res.json();
      if (!data.ok) return new Response(JSON.stringify({ success: false, error: data.description || "Chat ID noto'g'ri" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send') {
      if (!chat_id || !message) return new Response(JSON.stringify({ error: 'chat_id and message required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text: message, parse_mode: parse_mode || 'HTML' }) });
      const data = await res.json();
      if (!data.ok) return new Response(JSON.stringify({ success: false, error: data.description }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }) });
      const data = await res.json();
      return new Response(JSON.stringify({ success: data.ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ===== HELPER FUNCTIONS =====

function ok() {
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}

async function startDataEntry(botToken: string, supabase: any, chatId: string, sd: any) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const fuelTypes = sd.fuelTypes || ['Propan', 'AI-91', 'AI-92', 'AI-95', 'Dizel', 'Metan'];
  const stationName = (sd.stations || [])[sd.stationIndex || 0] || sd.companyName;

  await upsertSession(supabase, chatId, {
    state: 'AWAITING_FUEL_TYPE',
    data: { ...sd, fuels: [], expenses: [], terminal: 0, date: yesterdayStr },
  });

  const buttons = fuelTypes.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `fuel_${ft}` }]);
  buttons.push([{ text: '✅ Tayyor', callback_data: 'fuel_done' }]);

  await sendMessage(botToken, chatId,
    `⛽ <b>${stationName}</b>\n📅 Sana: <b>${yesterdayStr}</b>\n\n⛽ <b>Yoqilg'i turini tanlang:</b>`,
    { inline_keyboard: buttons }
  );
}

async function addFuelAndContinue(botToken: string, supabase: any, chatId: string, sd: any, prixod: number) {
  const fuelEntry = { type: sd.currentFuel, end: sd.currentEnd, price: 0, prixod, start: sd.currentStart || 0 };
  const updatedFuels = [...(sd.fuels || []), fuelEntry];

  const fuelTypes = sd.fuelTypes || [];
  const addedTypes = updatedFuels.map((f: any) => f.type);
  const remaining = fuelTypes.filter((ft: string) => !addedTypes.includes(ft));
  const buttons = remaining.map((ft: string) => [{ text: `⛽ ${ft}`, callback_data: `fuel_${ft}` }]);
  buttons.push([{ text: '✅ Tayyor', callback_data: 'fuel_done' }]);

  const newSd = { ...sd, fuels: updatedFuels, currentFuel: null, currentEnd: null, currentStart: null };
  await upsertSession(supabase, chatId, { state: 'AWAITING_FUEL_TYPE', data: newSd });
  await sendMessage(botToken, chatId, `✅ <b>${fuelEntry.type}</b> qo'shildi!\n\n⛽ Keyingisini tanlang:`, { inline_keyboard: buttons });
}

async function showExpenseMenu(botToken: string, chatId: string, sd: any) {
  const presets = ['Elektr', 'Gaz', 'Suv', 'Ish haqi', 'Transport'];
  const buttons = presets.map(p => [{ text: `💸 ${p}`, callback_data: `exp_${p}` }]);
  buttons.push([{ text: '✏️ Boshqa xarajat', callback_data: 'exp_custom' }]);
  buttons.push([{ text: "✅ Xarajat yo'q / Tayyor", callback_data: 'exp_done' }]);
  const expCount = (sd.expenses || []).length;
  const msg = expCount > 0 ? `💸 <b>${expCount} ta xarajat kiritildi.</b>\nYana qo'shing yoki Tayyor bosing:` : '💸 <b>Xarajat bormi?</b>';
  await sendMessage(botToken, chatId, msg, { inline_keyboard: buttons });
}

async function showConfirmation(botToken: string, supabase: any, chatId: string, sd: any) {
  const fuels = sd.fuels || [];
  const expenses = sd.expenses || [];
  const terminalVal = sd.terminal || 0;

  let totalSales = 0;
  let summary = `📋 <b>TEKSHIRUV</b>\n\n📅 ${sd.date}\n🔧 ${sd.name || sd.login}\n⛽ ${(sd.stations || [])[sd.stationIndex || 0] || sd.companyName}\n\n`;

  summary += `⛽ <b>Sotilgan yoqilg'i:</b>\n`;
  for (const f of fuels) {
    const sold = f.end - (f.start || 0) + (f.prixod || 0);
    const revenue = sold * (f.price || 0);
    totalSales += revenue;
    summary += `  • ${f.type}: ${numFmt(sold)} L × ${numFmt(f.price || 0)} = ${numFmt(revenue)} so'm\n`;
  }

  summary += `\n💰 Jami sotuv: <b>${numFmt(totalSales)} so'm</b>\n`;
  summary += `💳 Terminal: <b>${numFmt(terminalVal)} so'm</b>\n`;

  let totalExp = 0;
  if (expenses.length > 0) {
    summary += `\n💸 <b>Xarajatlar:</b>\n`;
    for (const e of expenses) { summary += `  • ${e.reason}: ${numFmt(e.amount)} so'm\n`; totalExp += e.amount; }
    summary += `📉 Jami xarajat: ${numFmt(totalExp)} so'm\n`;
  }

  const naqdPul = totalSales - terminalVal - totalExp;
  summary += `\n💵 <b>Naqd pul: ${numFmt(naqdPul)} so'm</b>`;

  await upsertSession(supabase, chatId, { state: 'AWAITING_CONFIRMATION', data: { ...sd, totalSales, totalExp, naqdPul } });
  await sendMessage(botToken, chatId, summary, {
    inline_keyboard: [
      [{ text: "✅ To'g'ri", callback_data: 'confirm_yes' }, { text: "✏️ Tahrirlash", callback_data: 'confirm_edit' }],
      [{ text: '❌ Bekor qilish', callback_data: 'confirm_no' }],
    ],
  });
}

async function sendReportToBoss(botToken: string, supabase: any, chatId: string, sd: any) {
  const bossChatId = sd.bossChatId;
  if (!bossChatId) { await sendMessage(botToken, chatId, '⚠️ Boss Chat ID topilmadi!'); return; }

  // Photos
  if (sd.meterPhotoId) await sendPhoto(botToken, bossChatId, sd.meterPhotoId, `📸 Hisoblagich — ${sd.name || sd.login} (${sd.date})`);
  if (sd.terminalPhotoId) await sendPhoto(botToken, bossChatId, sd.terminalPhotoId, `📸 Terminal chek — ${sd.name || sd.login} (${sd.date})`);

  // Report
  const fuels = sd.fuels || [];
  const expenses = sd.expenses || [];
  const terminalVal = sd.terminal || 0;
  const stationName = (sd.stations || [])[sd.stationIndex || 0] || sd.companyName;

  let totalSales = 0;
  let report = `📊 <b>OPERATOR HISOBOTI</b>\n\n📅 ${sd.date}\n🔧 ${sd.name || sd.login}\n🏢 ${stationName}\n\n`;

  if (fuels.length > 0) {
    report += `⛽ <b>Sotilgan yoqilg'i:</b>\n`;
    for (const f of fuels) {
      const sold = f.end - (f.start || 0) + (f.prixod || 0);
      const revenue = sold * (f.price || 0);
      totalSales += revenue;
      report += `  • ${f.type}: ${numFmt(sold)} L × ${numFmt(f.price || 0)} = ${numFmt(revenue)} so'm\n`;
    }
    report += `\n💰 Jami sotuv: <b>${numFmt(totalSales)} so'm</b>\n`;
  }

  report += `💳 Terminal: <b>${numFmt(terminalVal)} so'm</b>\n`;

  let totalExp = 0;
  if (expenses.length > 0) {
    report += `\n💸 <b>Xarajatlar:</b>\n`;
    for (const e of expenses) { report += `  • ${e.reason}: ${numFmt(e.amount)} so'm\n`; totalExp += e.amount; }
    report += `📉 Jami xarajat: <b>${numFmt(totalExp)} so'm</b>\n`;
  }

  const naqdPul = totalSales - terminalVal - totalExp;
  const foyda = totalSales - totalExp;
  report += `\n💵 Naqd pul: <b>${numFmt(naqdPul)} so'm</b>\n`;
  report += `📈 Foyda: <b>${numFmt(foyda)} so'm</b>\n`;
  report += `\n✅ Operator tasdiqladi\n🤖 BAREL.uz`;

  await sendMessage(botToken, bossChatId, report, {
    inline_keyboard: [[{ text: "💸 Xarajatlar batafsil", callback_data: `detail_exp_${sd.date}` }]],
  });

  // Reset to authenticated
  await upsertSession(supabase, chatId, {
    state: 'AUTHENTICATED',
    data: { login: sd.login, companyKey: sd.companyKey, bossChatId: sd.bossChatId, fuelTypes: sd.fuelTypes, companyName: sd.companyName, name: sd.name, role: sd.role, stations: sd.stations, stationIndex: sd.stationIndex },
  });
  await sendMessage(botToken, chatId, "✅ Ma'lumotlar Boss ga yuborildi! ⏱️ 15 daqiqa ichida tahrirlash mumkin.", {
    inline_keyboard: [[{ text: '📊 Yangi kiritish', callback_data: 'menu_kiritish' }]],
  });
}
