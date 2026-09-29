import { json } from './lib/http.mjs';
export default function handler(_req, res) { json(res, 200, { ok: true, service: 'Friends Included finance system' }); }
