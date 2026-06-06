const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const d = await db.getAsync();
  let txs = d.transactions;
  if (req.query.date) txs = txs.filter(t => t.createdAt.startsWith(req.query.date));
  const today = new Date().toISOString().slice(0, 10);
  const todayTxs = d.transactions.filter(t => t.createdAt.startsWith(today));
  const summary = {
    total: d.transactions.length,
    totalRevenue: d.transactions.reduce((s, t) => s + t.amount, 0),
    todayCount: todayTxs.length,
    todayRevenue: todayTxs.reduce((s, t) => s + t.amount, 0),
    activeVouchers: d.vouchers.filter(v => v.status === 'unused').length,
    totalVouchers: d.vouchers.length,
  };
  res.json({ success: true, transactions: txs.reverse().slice(0, 500), summary });
});

module.exports = router;
