// Stripe Webhook — підписи перевіряються через HMAC-SHA256
// ENV: STRIPE_WEBHOOK_SECRET (з Stripe Dashboard → Webhooks)
// Events: checkout.session.completed, invoice.payment_failed, customer.subscription.deleted

const crypto = require('crypto');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, sigHeader, secret) {
  const parts = {};
  sigHeader.split(',').forEach(p => { const [k, v] = p.split('='); parts[k] = v; });
  const { t, v1 } = parts;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return false; // 5 хв толеранція
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch { return false; }
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).json({ error: 'Missing signature config' });

  const rawBody = await getRawBody(req);

  if (!verifySignature(rawBody, sig, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      console.log(`[Stripe] Нова підписка: ${s.id} customer=${s.customer} email=${s.customer_details?.email}`);
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      console.log(`[Stripe] Оплата не пройшла: customer=${inv.customer} attempt=${inv.attempt_count}`);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`[Stripe] Підписка скасована: ${sub.id} customer=${sub.customer}`);
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log(`[Stripe] Підписка оновлена: ${sub.id} status=${sub.status}`);
      break;
    }
    default:
      break;
  }

  return res.status(200).json({ received: true });
}

handler.config = { api: { bodyParser: false } }; // raw body для перевірки підпису
module.exports = handler;
