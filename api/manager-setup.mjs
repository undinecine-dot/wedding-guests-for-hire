import { body, error, json } from './lib/http.mjs';
import { supabase, encode } from './lib/db.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'POST required.');
  try {
    const input = await body(req);
    if (input.actor !== 'svetlana') throw new Error('Only Svetlana can link Telegram identities.');
    if (!['richard','anastasia','jean-claude','kevin','svetlana'].includes(input.employee)) throw new Error('Choose an employee.');
    if (input.action === 'unlink') {
      const rows = await supabase(`employees?code=eq.${encode(input.employee)}`, { method:'PATCH', body: JSON.stringify({ telegram_user_id: null, linked_telegram_chat_id: null }) });
      return json(res, 200, { ok:true, employee:rows[0], message:'Telegram identity unlinked. Existing transaction ownership and notification destinations were not changed.' });
    }
    const telegramUserId = String(input.telegram_user_id || '').trim();
    if (!telegramUserId) throw new Error('Enter a Telegram user ID to link or relink it.');
    // A reviewer can move one real Telegram account between fictional roles.
    // Clear the previous employee first so the unique constraint never fails.
    await supabase(`employees?telegram_user_id=eq.${encode(telegramUserId)}&code=neq.${encode(input.employee)}`, { method:'PATCH', body: JSON.stringify({ telegram_user_id: null, linked_telegram_chat_id: null }) });
    const rows = await supabase(`employees?code=eq.${encode(input.employee)}`, { method:'PATCH', body: JSON.stringify({ telegram_user_id:String(input.telegram_user_id).trim(), linked_telegram_chat_id: input.telegram_chat_id ? String(input.telegram_chat_id).trim() : null }) });
    json(res, 200, { ok:true, employee:rows[0], message:'Telegram identity linked safely. Existing transaction ownership and notification destinations were not changed.' });
  } catch (err) { error(res,400,err.message); }
}
