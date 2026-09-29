import { supabase, encode } from './db.mjs';
import { upsertSheet } from './google-sheets.mjs';

const people = ['richard','anastasia','jean-claude'];
const allocation = new Set(['A','B','overhead']);
const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clean = (v) => String(v ?? '').trim();

export function validateSplit(input) {
  const values = people.map((p) => Number(input[p]));
  if (values.some((x) => !Number.isFinite(x) || x < 0 || x > 100) || money(values.reduce((a, b) => a + b, 0)) !== 100) throw new Error('Commission shares must each be 0–100% and total exactly 100%.');
  return Object.fromEntries(people.map((p, i) => [p, values[i]]));
}

function commissions(amount, split) {
  const pool = money(amount * 0.10);
  const raw = people.map((p) => money(pool * split[p] / 100));
  const rounding = money(pool - raw.reduce((a, b) => a + b, 0));
  const largest = [...people].sort((a, b) => split[b] - split[a] || people.indexOf(a) - people.indexOf(b))[0];
  raw[people.indexOf(largest)] = money(raw[people.indexOf(largest)] + rounding);
  return { pool, values: Object.fromEntries(people.map((p, i) => [p, raw[i]])) };
}

export async function employee(code) {
  const rows = await supabase(`employees?code=eq.${encode(code)}&select=*`);
  if (!rows[0]) throw new Error('Unknown employee.');
  return rows[0];
}

async function sync(kind, row) {
  try {
    await upsertSheet(kind, row);
    await supabase(`${kind === 'sale' ? 'sales' : 'expenses'}?reference=eq.${encode(row.reference)}`, { method: 'PATCH', body: JSON.stringify({ sync_status: 'synced', sync_error: null }) });
    row.sync_status = 'synced'; row.sync_error = null;
  } catch (err) {
    await supabase(`${kind === 'sale' ? 'sales' : 'expenses'}?reference=eq.${encode(row.reference)}`, { method: 'PATCH', body: JSON.stringify({ sync_status: 'failed', sync_error: err.message }) });
    row.sync_status = 'failed'; row.sync_error = err.message;
  }
}

export async function submitSale(actorCode, input, source = 'website', chatId = null) {
  const actor = await employee(actorCode);
  if (actor.role !== 'salesperson') throw new Error('Only a salesperson can submit a sale.');
  const reference = clean(input.reference).toUpperCase(), customer = clean(input.customer), description = clean(input.description);
  const amount = money(input.amount), project = clean(input.project);
  if (!/^S[0-9]+$/.test(reference) || !customer || !description || !['A','B'].includes(project) || !(amount > 0)) throw new Error('Sale reference, customer, project, description, and an amount greater than zero are required.');
  const split = validateSplit(input.split || input);
  const row = { reference, salesperson_code: actor.code, customer, description, project, amount, proposed_richard: split.richard, proposed_anastasia: split.anastasia, proposed_jean_claude: split['jean-claude'], source, originating_telegram_chat_id: chatId || actor.linked_telegram_chat_id || null };
  let inserted;
  try { inserted = (await supabase('sales', { method: 'POST', body: JSON.stringify(row) }))[0]; } catch (err) { if (/duplicate|unique/i.test(err.message)) throw new Error(`Reference ${reference} already exists.`); throw err; }
  await sync('sale', inserted);
  return inserted;
}

export async function submitExpense(actorCode, input, source = 'website', chatId = null) {
  const actor = await employee(actorCode);
  if (actor.role !== 'expense_reporter') throw new Error('Only Kevin can submit an expense.');
  const reference = clean(input.reference).toUpperCase(), description = clean(input.description), category = clean(input.category), proposed = clean(input.proposed_allocation);
  const amount = money(input.amount);
  if (!/^E[0-9]+$/.test(reference) || !description || !['Materials','Travel','Other'].includes(category) || !allocation.has(proposed) || !(amount > 0)) throw new Error('Expense reference, description, category, allocation, and an amount greater than zero are required.');
  const status = proposed === 'overhead' ? 'allocated' : 'awaiting_allocation';
  const row = { reference, reporter_code: actor.code, description, category, amount, proposed_allocation: proposed, final_allocation: proposed === 'overhead' ? 'overhead' : null, status, source, originating_telegram_chat_id: chatId || actor.linked_telegram_chat_id || null };
  let inserted;
  try { inserted = (await supabase('expenses', { method: 'POST', body: JSON.stringify(row) }))[0]; } catch (err) { if (/duplicate|unique/i.test(err.message)) throw new Error(`Reference ${reference} already exists.`); throw err; }
  await sync('expense', inserted);
  return inserted;
}

async function telegram(text, chatId) {
  if (!chatId) return { skipped: true };
  const result = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
  const data = await result.json();
  if (!result.ok || !data.ok) throw new Error(data.description || 'Telegram delivery failed.');
}

export async function decideSale(managerCode, reference, split) {
  const manager = await employee(managerCode);
  if (manager.role !== 'manager') throw new Error('Only Svetlana can approve or correct sales.');
  const rows = await supabase(`sales?reference=eq.${encode(reference)}&select=*`), sale = rows[0];
  if (!sale) throw new Error('Sale not found.');
  if (sale.status === 'approved') return sale;
  const finalSplit = validateSplit(split);
  const c = commissions(Number(sale.amount), finalSplit);
  const patch = { approved_richard: finalSplit.richard, approved_anastasia: finalSplit.anastasia, approved_jean_claude: finalSplit['jean-claude'], commission_pool: c.pool, commission_richard: c.values.richard, commission_anastasia: c.values.anastasia, commission_jean_claude: c.values['jean-claude'], status: 'approved', decided_at: new Date().toISOString(), manager_code: manager.code };
  const updated = (await supabase(`sales?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify(patch) }))[0];
  await sync('sale', updated);
  const changed = people.some((p) => Number(sale[`proposed_${p.replace('-', '_')}`]) !== finalSplit[p]);
  try { await telegram(`Sale ${updated.reference} approved${changed ? ' — commission split changed' : ''}. Sale €${updated.amount}; total commission €${updated.commission_pool}. Richard: ${updated.approved_richard}% (€${updated.commission_richard}). Anastasia: ${updated.approved_anastasia}% (€${updated.commission_anastasia}). Jean-Claude: ${updated.approved_jean_claude}% (€${updated.commission_jean_claude}).`, updated.originating_telegram_chat_id); await supabase(`sales?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify({ notified_at: new Date().toISOString(), notification_error: null }) }); } catch (err) { await supabase(`sales?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify({ notification_error: err.message }) }); }
  return updated;
}

export async function decideExpense(managerCode, reference, finalAllocation) {
  const manager = await employee(managerCode);
  if (manager.role !== 'manager') throw new Error('Only Svetlana can approve or correct expenses.');
  if (!allocation.has(finalAllocation)) throw new Error('Choose Project A, Project B, or Company overhead.');
  const rows = await supabase(`expenses?reference=eq.${encode(reference)}&select=*`), expense = rows[0];
  if (!expense) throw new Error('Expense not found.');
  if (expense.status === 'allocated') return expense;
  const updated = (await supabase(`expenses?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify({ final_allocation: finalAllocation, status: 'allocated', decided_at: new Date().toISOString(), manager_code: manager.code }) }))[0];
  await sync('expense', updated);
  try { await telegram(`Expense ${updated.reference}${finalAllocation !== expense.proposed_allocation ? ' — allocation changed' : ''}. €${updated.amount}: ${updated.description}. Proposed: ${expense.proposed_allocation}. Approved: ${finalAllocation}.`, updated.originating_telegram_chat_id); await supabase(`expenses?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify({ notified_at: new Date().toISOString(), notification_error: null }) }); } catch (err) { await supabase(`expenses?reference=eq.${encode(reference)}`, { method: 'PATCH', body: JSON.stringify({ notification_error: err.message }) }); }
  return updated;
}

export async function retry(kind, reference) {
  const table = kind === 'sale' ? 'sales' : 'expenses';
  const rows = await supabase(`${table}?reference=eq.${encode(reference)}&select=*`);
  if (!rows[0]) throw new Error('Transaction not found.');
  await sync(kind, rows[0]);
  return rows[0];
}
