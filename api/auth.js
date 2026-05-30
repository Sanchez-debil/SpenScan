// Auth — реєстрація, логін, верифікація JWT
// Storage: Vercel KV (Redis REST API)
// ENV: KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET
//
// POST /api/auth  { action:'signup', email, password }  → { token }
// POST /api/auth  { action:'login',  email, password }  → { token }
// GET  /api/auth  Authorization: Bearer <token>         → { email, plan }

const crypto = require('crypto');

// ── KV helpers ──────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(
    `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } }
  );
  const d = await r.json();
  if (d.result === null || d.result === undefined) return null;
  try {
    const parsed = JSON.parse(d.result);
    // handle legacy double-encoded values
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch { return null; }
}

async function kvSet(key, value, exSec) {
  const cmd = ['SET', key, JSON.stringify(value)];
  if (exSec) cmd.push('EX', String(exSec));
  await fetch(`${process.env.KV_REST_API_URL}/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
}

// ── Password ─────────────────────────────────────────────
function hashPwd(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256').toString('hex');
}

function genSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// ── JWT (HS256, no npm) ───────────────────────────────────
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function signJWT(payload, secret, ttlSec = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const bdy = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${hdr}.${bdy}`).digest());
  return `${hdr}.${bdy}.${sig}`;
}

function verifyJWT(token, secret) {
  try {
    const [hdr, bdy, sig] = token.split('.');
    const expected = b64url(crypto.createHmac('sha256', secret).update(`${hdr}.${bdy}`).digest());
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(bdy, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// ── Handler ───────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const jwtSecret = process.env.JWT_SECRET;

  if (!kvUrl || !kvToken || !jwtSecret) {
    return res.status(503).json({ error: 'Auth не налаштований — додайте KV_REST_API_URL, KV_REST_API_TOKEN, JWT_SECRET у Vercel' });
  }

  // ── GET — верифікація токена ──
  if (req.method === 'GET') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Немає токена' });

    const payload = verifyJWT(token, jwtSecret);
    if (!payload) return res.status(401).json({ error: 'Токен невалідний або прострочений' });

    const user = await kvGet(`user:${payload.email}`);
    if (!user) return res.status(401).json({ error: 'Акаунт не знайдено' });

    return res.status(200).json({ email: user.email, createdAt: user.createdAt });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const { action, email, password } = req.body || {};

  if (!email || !password) return res.status(400).json({ error: 'Email та пароль обовʼязкові' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Невірний формат email' });
  if (password.length < 8) return res.status(400).json({ error: 'Пароль мінімум 8 символів' });

  const emailKey = `user:${email.toLowerCase().trim()}`;

  // ── Реєстрація ──
  if (action === 'signup') {
    const existing = await kvGet(emailKey);
    if (existing) return res.status(409).json({ error: 'Цей email вже зареєстровано' });

    const salt = genSalt();
    const hash = hashPwd(password, salt);
    await kvSet(emailKey, {
      email: email.toLowerCase().trim(),
      hash,
      salt,
      createdAt: new Date().toISOString(),
    });

    const token = signJWT({ email: email.toLowerCase().trim() }, jwtSecret);
    return res.status(201).json({ token });
  }

  // ── Логін ──
  if (action === 'login') {
    const user = await kvGet(emailKey);
    if (!user) return res.status(401).json({ error: 'Невірний email або пароль' });

    const hash = hashPwd(password, user.salt);
    const valid = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.hash));
    if (!valid) return res.status(401).json({ error: 'Невірний email або пароль' });

    const token = signJWT({ email: user.email }, jwtSecret);
    return res.status(200).json({ token });
  }

  return res.status(400).json({ error: `Невідома дія: ${action}` });
};
