import crypto from 'node:crypto';

function credentials() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_SHEET_ID) return null;
  return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
const b64url = (value) => Buffer.from(value).toString('base64url');

async function token() {
  const c = credentials();
  if (!c) throw new Error('Google Sheets environment variables are missing.');
  const now = Math.floor(Date.now() / 1000);
  const signed = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))}`;
  const signature = crypto.createSign('RSA-SHA256').update(signed).end().sign(c.private_key, 'base64url');
  const result = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${signed}.${signature}` }) });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error_description || 'Could not obtain Google access token.');
  return data.access_token;
}

async function sheets(path, options = {}) {
  const accessToken = await token();
  const result = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}/${path}`, { ...options, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await result.json();
  if (!result.ok) throw new Error(data.error?.message || 'Google Sheets request failed.');
  return data;
}

const salesHeaders = ['Reference','Submission time','Salesperson','Customer','Project','Description','Amount','Proposed Richard','Proposed Anastasia','Proposed Jean Claude','Approved Richard','Approved Anastasia','Approved Jean Claude','Commission Richard','Commission Anastasia','Commission Jean Claude','Status'];
const expenseHeaders = ['Reference','Submission time','Reporter','Description','Category','Amount','Proposed allocation','Final allocation','Status'];

export async function upsertSheet(kind, record) {
  const tab = kind === 'sale' ? 'Sales' : 'Expenses';
  const header = kind === 'sale' ? salesHeaders : expenseHeaders;
  const row = kind === 'sale'
    ? [record.reference, record.submitted_at, record.salesperson_code, record.customer, record.project, record.description, record.amount, record.proposed_richard, record.proposed_anastasia, record.proposed_jean_claude, record.approved_richard ?? '', record.approved_anastasia ?? '', record.approved_jean_claude ?? '', record.commission_richard ?? 0, record.commission_anastasia ?? 0, record.commission_jean_claude ?? 0, record.status]
    : [record.reference, record.submitted_at, record.reporter_code, record.description, record.category, record.amount, record.proposed_allocation, record.final_allocation ?? '', record.status];
  const range = encodeURIComponent(`${tab}!A:Q`);
  const existing = await sheets(`values/${range}`);
  const rows = existing.values || [];
  if (!rows.length) await sheets(`values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [header] }) });
  const rowIndex = rows.findIndex((r, index) => index > 0 && r[0] === record.reference);
  if (rowIndex >= 0) {
    await sheets(`values/${encodeURIComponent(`${tab}!A${rowIndex + 1}`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [row] }) });
  } else {
    await sheets(`values/${encodeURIComponent(`${tab}!A:Q`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [row] }) });
  }
}

const encodeURIComponent = globalThis.encodeURIComponent;
