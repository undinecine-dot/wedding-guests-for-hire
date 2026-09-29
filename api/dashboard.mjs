import { error, json } from './lib/http.mjs';
import { supabase } from './lib/db.mjs';
const n = (x) => Number(x || 0);
const r = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 405, 'GET required.');
  try {
    const [sales, expenses, employees] = await Promise.all([supabase('sales?select=*&order=submitted_at.desc'), supabase('expenses?select=*&order=submitted_at.desc'), supabase('employees?select=code,name,role,telegram_user_id,linked_telegram_chat_id&order=code')]);
    const approved = sales.filter(x => x.status === 'approved');
    const project = (p) => {
      const projectSales = approved.filter(x => x.project === p);
      const allocated = expenses.filter(x => x.status === 'allocated' && x.final_allocation === p);
      const income = projectSales.reduce((a,x) => a+n(x.amount),0), commission = projectSales.reduce((a,x) => a+n(x.commission_pool),0), expense = allocated.reduce((a,x)=>a+n(x.amount),0);
      return { income:r(income), commission:r(commission), expense:r(expense), result:r(income-commission-expense) };
    };
    const companyIncome = approved.reduce((a,x)=>a+n(x.amount),0), companyCommission = approved.reduce((a,x)=>a+n(x.commission_pool),0), allExpenses = expenses.reduce((a,x)=>a+n(x.amount),0);
    const overhead = expenses.filter(x=>x.status === 'allocated' && x.final_allocation === 'overhead').reduce((a,x)=>a+n(x.amount),0);
    const awaiting = expenses.filter(x=>x.status === 'awaiting_allocation').reduce((a,x)=>a+n(x.amount),0);
    const commissions = { richard: r(approved.reduce((a,x)=>a+n(x.commission_richard),0)), anastasia:r(approved.reduce((a,x)=>a+n(x.commission_anastasia),0)), 'jean-claude':r(approved.reduce((a,x)=>a+n(x.commission_jean_claude),0)) };
    json(res, 200, { ok:true, sales, expenses, employees, totals: { A:project('A'), B:project('B'), company:{income:r(companyIncome),commission:r(companyCommission),overhead:r(overhead),awaiting:r(awaiting),result:r(companyIncome-companyCommission-allExpenses)}, commissions } });
  } catch (err) { error(res, 500, err.message); }
}
