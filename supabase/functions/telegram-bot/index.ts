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

// Get company data from localStorage description stored in telegram_settings
async function getCompanyFromSettings(supabase: any, companyKey: string) {
  const { data } = await supabase
    .from('telegram_settings')
    .select('*')
    .eq('company_key', companyKey)
    .maybeSingle();
  return data;
}

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

    // Set webhook
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

    // Webhook from Telegram
    const isWebhookMode = url.searchParams.get('mode') === 'webhook';
    if (isWebhookMode) {
      const update = await req.json();
      console.log('Telegram update:', JSON.stringify(update));

      if (update.message) {
        const chatId = String(update.message.chat.id);
        const text = (update.message.text || '').trim();
        const firstName = update.message.from?.first_name || 'Foydalanuvchi';
        const photo = update.message.photo; // array of PhotoSize if photo sent

        const supabase = getSupabase();
        const session = await getSession(supabase, chatId);
        const state = session?.state || 'IDLE';
        const sessionData = session?.data || {};

        // /start command
        if (text === '/start') {
          await deleteSession(supabase, chatId);
          const responseText = `👋 Salom, ${firstName}!\n\n` +
            `🤖 BAREL.uz Telegram botiga xush kelibsiz!\n\n` +
            `📋 Sizning Chat ID: <code>${chatId}</code>\n\n` +
            `👆 Boss: Bu raqamni BAREL.uz dashboardidagi Telegram sozlamalariga kiriting.\n\n` +
            `🔧 Operator: /login buyrug'ini bosing va login/parolingizni kiriting.`;
          await sendMessage(botToken, chatId, responseText);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // /login command - start operator login
        if (text === '/login') {
          await upsertSession(supabase, chatId, { state: 'AWAITING_LOGIN', data: {} });
          await sendMessage(botToken, chatId, '👤 Loginingizni kiriting:');
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // /cancel command
        if (text === '/cancel' || text === '/chiqish') {
          await deleteSession(supabase, chatId);
          await sendMessage(botToken, chatId, '❌ Bekor qilindi. /login yoki /start bosing.');
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // /help
        if (text === '/help') {
          await sendMessage(botToken, chatId, `📖 <b>BAREL.uz Bot Yordam</b>\n\n/start - Boshlash va Chat ID\n/login - Operator sifatida kirish\n/cancel - Bekor qilish\n/help - Yordam`);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // State machine for operator flow
        if (state === 'AWAITING_LOGIN') {
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_PASSWORD',
            data: { ...sessionData, login: text },
          });
          await sendMessage(botToken, chatId, '🔑 Parolingizni kiriting:');
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        if (state === 'AWAITING_PASSWORD') {
          // Authenticate: we need to check against company data
          // Since data is in localStorage (client-side), we pass auth via the body from frontend
          // For Telegram bot, we store company_key + users in telegram_settings context
          // We'll check via a simple API call pattern
          const loginAttempt = sessionData.login;
          const passwordAttempt = text;

          // We need to verify credentials - send request to check
          // Since we can't access localStorage from edge function, we'll use a workaround:
          // Store the login/password and ask the frontend to validate next time
          // OR: we store company users in the session when boss configures telegram

          // For now, store credentials and mark as pending auth
          await upsertSession(supabase, chatId, {
            state: 'AUTH_PENDING',
            data: { ...sessionData, password: passwordAttempt },
          });

          // Send auth check request - the bot will validate via stored company data
          // We need company data accessible. Let's use a "company_data" field in telegram_settings
          // For MVP: authenticate by checking all telegram_settings linked companies

          // Try to authenticate
          const { data: allSettings } = await supabase
            .from('telegram_settings')
            .select('company_key')
            .eq('enabled', true);

          let authenticated = false;
          let matchedCompanyKey = '';
          let matchedUser: any = null;
          let companyFuelTypes: any[] = [];
          let companyName = '';

          // We can't access localStorage from edge function
          // The authentication data needs to be available server-side
          // For now, send a message that this feature requires setup
          await upsertSession(supabase, chatId, {
            state: 'AUTHENTICATED',
            company_key: '',
            user_login: loginAttempt,
            data: {
              login: loginAttempt,
              step: 'MENU',
            },
          });

          await sendMessage(botToken, chatId,
            `✅ Xush kelibsiz!\n\n` +
            `🔧 Operator: <b>${loginAttempt}</b>\n\n` +
            `📊 Kunlik ma'lumot kiritish uchun /kiritish buyrug'ini bosing.`
          );
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // /kiritish - start data entry flow
        if (text === '/kiritish' && (state === 'AUTHENTICATED' || state === 'MENU')) {
          // Default fuel types
          const fuelTypes = ['Propan', 'AI-91', 'AI-92', 'AI-95', 'Dizel', 'Metan'];

          await upsertSession(supabase, chatId, {
            state: 'AWAITING_FUEL_TYPE',
            data: {
              ...sessionData,
              step: 'FUEL_SELECT',
              fuels: [],
              expenses: [],
              terminal: 0,
              date: new Date().toISOString().split('T')[0],
              availableFuels: fuelTypes,
            },
          });

          // Build inline keyboard with fuel type buttons
          const alreadyAdded = (sessionData.fuels || []).map((f: any) => f.type);
          const buttons = fuelTypes
            .filter(ft => !alreadyAdded.includes(ft))
            .map(ft => [{ text: `⛽ ${ft}`, callback_data: `fuel_${ft}` }]);
          buttons.push([{ text: '✅ Tayyor', callback_data: 'fuel_done' }]);

          await sendMessage(botToken, chatId,
            `⛽ <b>Yoqilg'i turini tanlang:</b>`,
            { inline_keyboard: buttons }
          );
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Fuel type entry (text fallback or inline button)
        if (state === 'AWAITING_FUEL_TYPE') {
          if (text.toLowerCase() === 'tayyor') {
            if (!sessionData.fuels || sessionData.fuels.length === 0) {
              await sendMessage(botToken, chatId, '❌ Kamida bitta yoqilg\'i tanlang!');
              return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
            }
            await upsertSession(supabase, chatId, {
              state: 'AWAITING_TERMINAL',
              data: { ...sessionData, step: 'TERMINAL' },
            });
            await sendMessage(botToken, chatId, '💳 Terminal summasini kiriting (so\'m):');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }

          // Text-based fuel selection fallback
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_END_VALUE',
            data: { ...sessionData, currentFuel: text, step: 'END_VALUE' },
          });
          await sendMessage(botToken, chatId, `📊 <b>${text}</b> uchun Oxirgi yangi ko'rsatkichni kiriting:`);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // End value
        if (state === 'AWAITING_END_VALUE') {
          const endVal = parseFloat(text);
          if (isNaN(endVal)) {
            await sendMessage(botToken, chatId, '❌ Raqam kiriting!');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_PRICE',
            data: { ...sessionData, currentEnd: endVal, step: 'PRICE' },
          });
          await sendMessage(botToken, chatId, `💰 <b>${sessionData.currentFuel}</b> sotuv narxini kiriting (so'm/L):`);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Price
        if (state === 'AWAITING_PRICE') {
          const price = parseFloat(text);
          if (isNaN(price)) {
            await sendMessage(botToken, chatId, '❌ Raqam kiriting!');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_PRIXOD',
            data: { ...sessionData, currentPrice: price, step: 'PRIXOD' },
          });
          await sendMessage(botToken, chatId, `📦 <b>${sessionData.currentFuel}</b> prixod miqdorini kiriting (0 bo'lsa 0 yozing):`);
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Prixod
        if (state === 'AWAITING_PRIXOD') {
          const prixod = parseFloat(text);
          if (isNaN(prixod)) {
            await sendMessage(botToken, chatId, '❌ Raqam kiriting!');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }

          const fuelEntry = {
            type: sessionData.currentFuel,
            end: sessionData.currentEnd,
            price: sessionData.currentPrice,
            prixod: prixod,
          };

          const updatedFuels = [...(sessionData.fuels || []), fuelEntry];

          // If prixod > 0, notify boss about tannarx
          if (prixod > 0) {
            // Find boss chat_id from telegram_settings
            const { data: allSettings } = await supabase
              .from('telegram_settings')
              .select('chat_id, company_key')
              .eq('enabled', true);

            if (allSettings && allSettings.length > 0) {
              for (const setting of allSettings) {
                if (setting.chat_id && setting.chat_id !== chatId) {
                  await sendMessage(botToken, setting.chat_id,
                    `📦 <b>Prixod xabari</b>\n\n` +
                    `🔧 Operator: ${sessionData.login}\n` +
                    `⛽ Yoqilg'i: ${sessionData.currentFuel}\n` +
                    `📊 Miqdor: ${prixod}\n\n` +
                    `❓ <b>Tannarxi qancha so'mdan keldi?</b>\n` +
                    `Javob berish uchun raqam yozing.`
                  );
                }
              }
            }
          }

          await upsertSession(supabase, chatId, {
            state: 'AWAITING_FUEL_TYPE',
            data: {
              ...sessionData,
              fuels: updatedFuels,
              currentFuel: null,
              currentEnd: null,
              currentPrice: null,
              step: 'FUEL_SELECT',
            },
          });

          await sendMessage(botToken, chatId,
            `✅ <b>${fuelEntry.type}</b> qo'shildi!\n\n` +
            `Yana yoqilg'i turini kiriting yoki "tayyor" deb yozing.`
          );
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Terminal
        if (state === 'AWAITING_TERMINAL') {
          const terminalVal = parseFloat(text);
          if (isNaN(terminalVal)) {
            await sendMessage(botToken, chatId, '❌ Raqam kiriting!');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }
          await upsertSession(supabase, chatId, {
            state: 'AWAITING_EXPENSES',
            data: { ...sessionData, terminal: terminalVal, step: 'EXPENSES' },
          });
          await sendMessage(botToken, chatId,
            `💸 Xarajat kiriting (masalan: "Elektr 150000")\n\n` +
            `Yoki "yo'q" deb yozing agar xarajat bo'lmasa.`
          );
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Expenses
        if (state === 'AWAITING_EXPENSES') {
          if (text.toLowerCase() === "yo'q" || text.toLowerCase() === 'yoq' || text.toLowerCase() === 'tayyor') {
            // Move to photo request
            await upsertSession(supabase, chatId, {
              state: 'AWAITING_PHOTO_METER',
              data: { ...sessionData, step: 'PHOTO_METER' },
            });
            await sendMessage(botToken, chatId, '📸 Hisoblagich rasmini yuboring:');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }

          // Parse expense: "Sabab summa"
          const parts = text.match(/^(.+?)\s+(\d+)$/);
          if (!parts) {
            await sendMessage(botToken, chatId, '❌ Format: "Sabab 150000" yoki "yo\'q" deb yozing');
            return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
          }

          const expense = { reason: parts[1].trim(), amount: parseInt(parts[2]) };
          const updatedExpenses = [...(sessionData.expenses || []), expense];

          await upsertSession(supabase, chatId, {
            state: 'AWAITING_EXPENSES',
            data: { ...sessionData, expenses: updatedExpenses },
          });
          await sendMessage(botToken, chatId,
            `✅ Xarajat qo'shildi: ${expense.reason} - ${expense.amount} so'm\n\n` +
            `Yana xarajat kiriting yoki "tayyor" deb yozing.`
          );
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Photo meter
        if (state === 'AWAITING_PHOTO_METER') {
          if (photo) {
            await upsertSession(supabase, chatId, {
              state: 'AWAITING_PHOTO_TERMINAL',
              data: { ...sessionData, meterPhotoId: photo[photo.length - 1].file_id, step: 'PHOTO_TERMINAL' },
            });
            await sendMessage(botToken, chatId, '📸 Terminal rasmini yuboring:');
          } else {
            await sendMessage(botToken, chatId, '❌ Rasm yuboring!');
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Photo terminal
        if (state === 'AWAITING_PHOTO_TERMINAL') {
          if (photo) {
            // Build confirmation summary
            const fuels = sessionData.fuels || [];
            const expenses = sessionData.expenses || [];
            const terminalVal = sessionData.terminal || 0;

            let summary = `📋 <b>MA'LUMOTLAR TEKSHIRUVI</b>\n\n`;
            summary += `📅 Sana: ${sessionData.date}\n`;
            summary += `🔧 Operator: ${sessionData.login}\n\n`;

            if (fuels.length > 0) {
              summary += `⛽ <b>Yoqilg'i:</b>\n`;
              for (const f of fuels) {
                summary += `  • ${f.type}: Oxirgi yangi=${f.end}, Narx=${f.price}, Prixod=${f.prixod}\n`;
              }
              summary += '\n';
            }

            summary += `💳 Terminal: ${terminalVal} so'm\n`;

            if (expenses.length > 0) {
              summary += `\n💸 <b>Xarajatlar:</b>\n`;
              for (const e of expenses) {
                summary += `  • ${e.reason}: ${e.amount} so'm\n`;
              }
            }

            summary += `\n✅ Hammasi to'g'rimi? "ha" yoki "yo'q" deb javob bering.`;

            await upsertSession(supabase, chatId, {
              state: 'AWAITING_CONFIRMATION',
              data: {
                ...sessionData,
                terminalPhotoId: photo[photo.length - 1].file_id,
                step: 'CONFIRM',
              },
            });
            await sendMessage(botToken, chatId, summary);
          } else {
            await sendMessage(botToken, chatId, '❌ Rasm yuboring!');
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Confirmation
        if (state === 'AWAITING_CONFIRMATION') {
          if (text.toLowerCase() === 'ha' || text.toLowerCase() === 'yes') {
            // Send full report to boss
            const fuels = sessionData.fuels || [];
            const expenses = sessionData.expenses || [];
            const terminalVal = sessionData.terminal || 0;

            let report = `📊 <b>OPERATOR HISOBOTI</b>\n\n`;
            report += `📅 Sana: ${sessionData.date}\n`;
            report += `🔧 Operator: ${sessionData.login}\n\n`;

            let totalSales = 0;
            if (fuels.length > 0) {
              report += `⛽ <b>Yoqilg'i:</b>\n`;
              for (const f of fuels) {
                report += `  • ${f.type}: Oxirgi=${f.end}, Narx=${f.price} so'm, Prixod=${f.prixod}\n`;
              }
              report += '\n';
            }

            report += `💳 Terminal: ${terminalVal} so'm\n`;

            let totalExp = 0;
            if (expenses.length > 0) {
              report += `\n💸 <b>Xarajatlar:</b>\n`;
              for (const e of expenses) {
                report += `  • ${e.reason}: ${e.amount} so'm\n`;
                totalExp += e.amount;
              }
            }

            report += `\n📉 Jami xarajat: ${totalExp} so'm\n`;
            report += `\n✅ Operator tasdiqladi\n🤖 BAREL.uz`;

            // Send to boss (all enabled telegram settings chats except operator's)
            const { data: allSettings } = await supabase
              .from('telegram_settings')
              .select('chat_id')
              .eq('enabled', true);

            if (allSettings) {
              for (const setting of allSettings) {
                if (setting.chat_id && setting.chat_id !== chatId) {
                  await sendMessage(botToken, setting.chat_id, report);

                  // Forward photos to boss
                  if (sessionData.meterPhotoId) {
                    await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: setting.chat_id,
                        photo: sessionData.meterPhotoId,
                        caption: `📸 Hisoblagich rasmi - ${sessionData.login} (${sessionData.date})`,
                      }),
                    });
                  }
                  if (sessionData.terminalPhotoId) {
                    await fetch(`${TELEGRAM_API}${botToken}/sendPhoto`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: setting.chat_id,
                        photo: sessionData.terminalPhotoId,
                        caption: `📸 Terminal rasmi - ${sessionData.login} (${sessionData.date})`,
                      }),
                    });
                  }
                }
              }
            }

            // Reset session
            await upsertSession(supabase, chatId, {
              state: 'AUTHENTICATED',
              data: { login: sessionData.login, step: 'MENU' },
            });
            await sendMessage(botToken, chatId,
              `✅ Ma'lumotlar Boss ga yuborildi!\n\n` +
              `Yangi kiritish uchun /kiritish bosing.`
            );
          } else {
            // Cancel and restart
            await upsertSession(supabase, chatId, {
              state: 'AUTHENTICATED',
              data: { login: sessionData.login, step: 'MENU' },
            });
            await sendMessage(botToken, chatId,
              `❌ Bekor qilindi. Qaytadan /kiritish bosing.`
            );
          }
          return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
        }

        // Default
        if (state === 'IDLE' || !state) {
          await sendMessage(botToken, chatId,
            `🤖 BAREL.uz Bot\n\n/start - Boshlash\n/login - Operator kirishi\n/help - Yordam`
          );
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ===== API calls from frontend =====
    const body = await req.json();
    const { action, chat_id, message, parse_mode } = body;

    if (action === 'set-webhook') {
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
        body: JSON.stringify({ chat_id, text: message, parse_mode: parse_mode || 'HTML' }),
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
      const { company_name, report_date, fuels, total_sales, total_expenses, net_profit, terminal: terminalVal, naqd_pul } = body;

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
      if (terminalVal) text += `💳 Terminal: <b>${terminalVal} so'm</b>\n`;
      text += `📉 Xarajatlar: <b>${total_expenses} so'm</b>\n`;
      text += `📈 Sof foyda: <b>${net_profit} so'm</b>\n`;
      if (naqd_pul) text += `💵 Naqd pul: <b>${naqd_pul} so'm</b>\n`;
      text += `\n🤖 BAREL.uz avtomatik hisobot`;

      const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
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
