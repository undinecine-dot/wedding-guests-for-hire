import { body, error, json } from './lib/http.mjs';
import { decideExpense, decideSale } from './lib/core.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'POST required.');
  try {
    const input = await body(req);
    const record = input.kind === 'sale' ? await decideSale(input.actor, input.reference, input.split) : await decideExpense(input.actor, input.reference, input.final_allocation);
    json(res, 200, { ok: true, record });
  } catch (err) { error(res, 400, err.message); }
}
