// Перевірка Stripe сесії після повернення з оплати
// GET /api/verify?session_id=cs_xxx

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(503).json({ error: 'Stripe not configured' });

  try {
    const r = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}` +
      `?expand[]=customer&expand[]=subscription`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const session = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: session.error?.message });

    const active = session.status === 'complete' || session.payment_status === 'paid';
    const rawPlan = session.subscription?.metadata?.plan || session.metadata?.plan || 'starter-monthly';
    const plan    = rawPlan.startsWith('pro') ? 'pro' : 'starter';
    const sub     = session.subscription;

    return res.status(200).json({
      active,
      plan,
      email:        session.customer_details?.email || session.customer?.email || '',
      customerId:   typeof session.customer === 'string' ? session.customer : session.customer?.id,
      periodEnd:    sub?.current_period_end   || null,
      cancelAtEnd:  sub?.cancel_at_period_end ?? false,
    });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
};
