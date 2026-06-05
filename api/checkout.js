// Stripe Checkout — створити сесію оплати
// ENV: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO_MONTHLY, ALLOWED_ORIGIN

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(503).json({ error: 'Stripe not configured' });

  const { plan } = req.body || {};
  const PRICES = {
    'pro-monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
  };

  const priceId = PRICES[plan];
  if (!priceId) return res.status(400).json({ error: `Невідомий план: ${plan}` });

  const host   = req.headers.host || '';
  const proto  = host.startsWith('localhost') ? 'http' : 'https';
  const origin = process.env.ALLOWED_ORIGIN || `${proto}://${host}`;

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': '1',
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/?checkout=cancel`,
    allow_promotion_codes: 'true',
    'subscription_data[trial_period_days]': '14',
    'subscription_data[metadata][plan]': plan,
  });

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: session.error?.message || 'Stripe error' });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
