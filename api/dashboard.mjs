import { error, json } from './lib/http.mjs';
import { supabase } from './lib/db.mjs';
const n = (x) => Number(x || 0);
const r = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 405, 'GET required.');
  try {
    const actor = new URL(req.url, 'https://friends-included.local').searchParams.get('actor');
    const allowed = ['richard', 'anastasia', 'jean-claude', 'kevin', 'svetlana'];
    if (!allowed.includes(actor)) return error(res, 400, 'Choose a valid demonstration role.');
    const [allSales, allExpenses, employees] = await Promise.all([supabase('sales?select=*&order=submitted_at.desc'), supabase('expenses?select=*&order=submitted_at.desc'), supabase('employees?select=code,name,role,telegram_user_id,linked_telegram_chat_id&order=code')]);
    // The selector is the exercise's demonstration login. Never send another
    // employee's transaction rows to a non-manager browser.
    const managerView = actor === 'svetlana';
    const sales = managerView ? allSales : allSales.filter((row) => row.salesperson_code === actor);
    const expenses = managerView ? allExpenses : allExpenses.filter((row) => row.reporter_code === actor);
    const calculateTotals = (calculationSales, calculationExpenses) => {
      const approved = calculationSales.filter((x) => x.status === 'approved');
      const project = (p) => {
        const projectSales = approved.filter((x) => x.project === p);
        const allocated = calculationExpenses.filter((x) => x.status === 'allocated' && x.final_allocation === p);
        const income = projectSales.reduce((a, x) => a + n(x.amount), 0);
        const commission = projectSales.reduce((a, x) => a + n(x.commission_pool), 0);
        const expense = allocated.reduce((a, x) => a + n(x.amount), 0);
        return { income: r(income), commission: r(commission), expense: r(expense), result: r(income - commission - expense) };
      };
      const companyIncome = approved.reduce((a, x) => a + n(x.amount), 0);
      const companyCommission = approved.reduce((a, x) => a + n(x.commission_pool), 0);
      const recordedExpenses = calculationExpenses.reduce((a, x) => a + n(x.amount), 0);
      const overhead = calculationExpenses.filter((x) => x.status === 'allocated' && x.final_allocation === 'overhead').reduce((a, x) => a + n(x.amount), 0);
      const awaiting = calculationExpenses.filter((x) => x.status === 'awaiting_allocation').reduce((a, x) => a + n(x.amount), 0);
      const commissions = {
        richard: r(approved.reduce((a, x) => a + n(x.commission_richard), 0)),
        anastasia: r(approved.reduce((a, x) => a + n(x.commission_anastasia), 0)),
        'jean-claude': r(approved.reduce((a, x) => a + n(x.commission_jean_claude), 0))
      };
      return { A: project('A'), B: project('B'), company: { income: r(companyIncome), commission: r(companyCommission), overhead: r(overhead), awaiting: r(awaiting), result: r(companyIncome - companyCommission - recordedExpenses) }, commissions };
    };
    // Live manager figures must include every valid transaction in the ledger.
    // The required coursework references are retained only as a separate comparison.
    const totals = calculateTotals(sales, expenses);
    const assignmentTotals = managerView ? calculateTotals(
      sales.filter((row) => /^S0[1-5]$/.test(row.reference)),
      expenses.filter((row) => /^E0[1-7]$/.test(row.reference))
    ) : null;
    json(res, 200, { ok:true, scope: managerView ? 'manager' : 'employee', actor, sales, expenses, employees: managerView ? employees : [], totals, assignmentTotals });
  } catch (err) { error(res, 500, err.message); }
}
