import { body, error, json } from './lib/http.mjs';
import { submitExpense, submitSale } from './lib/core.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'POST required.');
  try {
    const input = await body(req);
    if (!input.actor || !['sale','expense'].includes(input.kind)) return error(res, 400, 'Actor and transaction type are required.');
    const record = input.kind === 'sale' ? await submitSale(input.actor, input, 'website') : await submitExpense(input.actor, input, 'website');
    json(res, 201, { ok: true, record, message: `${record.reference} saved. Google Sheets status: ${record.sync_status}.` });
  } catch (err) { error(res, 400, err.message); }
}
