import { body, error, json } from './lib/http.mjs';
import { supabase, encode } from './lib/db.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'POST required.');
  try {
    const input = await body(req);
    if (input.actor !== 'svetlana') throw new Error('Only Svetlana can link Telegram identities.');
    if (!['richard','anastasia','jean-claude','kevin','svetlana'].includes(input.employee) || !String(input.telegram_user_id || '').trim()) throw new Error('Choose an employee and enter a Telegram user ID.');
    const rows = await supabase(`employees?code=eq.${encode(input.employee)}`, { method:'PATCH', body: JSON.stringify({ telegram_user_id:String(input.telegram_user_id).trim(), linked_telegram_chat_id: input.telegram_chat_id ? String(input.telegram_chat_id).trim() : null }) });
    json(res, 200, { ok:true, employee:rows[0] });
  } catch (err) { error(res,400,err.message); }
}
