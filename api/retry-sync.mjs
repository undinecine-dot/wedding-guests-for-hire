import { body, error, json } from './lib/http.mjs';
import { retry } from './lib/core.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return error(res, 405, 'POST required.');
  try { const input = await body(req); json(res, 200, { ok: true, record: await retry(input.kind, input.reference) }); }
  catch (err) { error(res, 400, err.message); }
}
