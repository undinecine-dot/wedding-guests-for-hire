import { body, error, json } from './lib/http.mjs';
import { supabase, encode } from './lib/db.mjs';
import { submitExpense, submitSale } from './lib/core.mjs';

const help = `Friends Included bot\n\nUse one line per command:\n/sale S01 | Olivia Rose | A | One proud uncle | 1000 | 50 | 30 | 20\n/expense E01 | Rented suit | Materials | 120 | A\n\nYour Telegram user ID must first be linked by Svetlana in Manager Setup.`;
async function say(chatId, text) { await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({chat_id:chatId,text}) }); }
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res,405,'POST required.');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) return error(res,401,'Invalid Telegram webhook secret.');
  let chatId;
  try {
    const update = await body(req), message = update.message;
    if (!message?.text) return json(res,200,{ok:true});
    chatId = String(message.chat.id); const userId = String(message.from.id), text = message.text.trim();
    if (text === '/start' || text === '/help') { await say(chatId,`${help}\n\nYour Telegram user ID: ${userId}\nYour chat ID: ${chatId}`); return json(res,200,{ok:true}); }
    const employees = await supabase(`employees?telegram_user_id=eq.${encode(userId)}&select=*`);
    if (!employees[0]) { await say(chatId,'Your Telegram user ID is not linked to a fictional employee. Ask Svetlana to link it in Manager Setup.'); return json(res,200,{ok:true}); }
    const actor = employees[0];
    // This changes only the employee's current linked chat; existing submissions retain their original chat ID.
    await supabase(`employees?code=eq.${encode(actor.code)}`, { method:'PATCH', body:JSON.stringify({ linked_telegram_chat_id:chatId }) });
    let record;
    const parts = text.split('|').map(x=>x.trim());
    if (parts[0].toLowerCase().startsWith('/sale')) {
      const first = parts[0].split(/\s+/); record = await submitSale(actor.code,{reference:first[1],customer:parts[1],project:parts[2],description:parts[3],amount:parts[4],split:{richard:parts[5],anastasia:parts[6],'jean-claude':parts[7]}},'telegram',chatId);
      await say(chatId,`Saved ${record.reference}: €${record.amount}, Project ${record.project}, status Pending approval. Sheet sync: ${record.sync_status}.`);
    } else if (parts[0].toLowerCase().startsWith('/expense')) {
      const first = parts[0].split(/\s+/); record = await submitExpense(actor.code,{reference:first[1],description:parts[1],category:parts[2],amount:parts[3],proposed_allocation:parts[4]},'telegram',chatId);
      await say(chatId,`Saved ${record.reference}: €${record.amount}, proposed ${record.proposed_allocation}, status ${record.status}. Sheet sync: ${record.sync_status}.`);
    } else await say(chatId,help);
  } catch (err) { if (chatId) await say(chatId,`Not saved: ${err.message}`); }
  json(res,200,{ok:true});
}
