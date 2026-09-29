const url = () => process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function supabase(path, options = {}) {
  if (!url() || !key()) throw new Error('Supabase environment variables are missing.');
  const response = await fetch(`${url()}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key(), authorization: `Bearer ${key()}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase error ${response.status}`);
  return data;
}

export const encode = (value) => encodeURIComponent(value);
