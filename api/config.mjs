import { json } from './lib/http.mjs';
export default function handler(_req, res) {
  json(res, 200, { ok: true, studentName: process.env.PUBLIC_STUDENT_NAME || 'Your Name', githubUrl: process.env.PUBLIC_GITHUB_URL || '#', sheetUrl: process.env.PUBLIC_GOOGLE_SHEET_URL || '#', botUrl: process.env.PUBLIC_TELEGRAM_BOT_URL || '#' });
}
