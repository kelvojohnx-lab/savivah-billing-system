const router = require('express').Router();
const db = require('../db');
const { createVoucher, createTransaction } = require('../utils/voucher');
const { pushVoucherToMikrotik } = require('../utils/mikrotik');

router.get('/', async (req, res) => {
  const d = await db.getAsync();
  let v = d.vouchers;
  if (req.query.status) v = v.filter(x => x.status === req.query.status);
  if (req.query.pkgId) v = v.filter(x => x.pkgId === Number(req.query.pkgId));
  res.json({ success: true, vouchers: v.reverse().slice(0, 200) });
});

router.post('/generate', async (req, res) => {
  try {
    const { pkgId, qty = 1, pushRouter = true } = req.body;
    const vouchers = [], txs = [];
    for (let i = 0; i < Math.min(qty, 50); i++) {
      const v = createVoucher(pkgId, 'manual');
      const tx = createTransaction(v, 'manual');
      vouchers.push(v); txs.push(tx);
      if (pushRouter) {
        const r = await pushVoucherToMikrotik(v);
        v.pushedToRouter = r.success; v.routerError = r.error || null;
      }
    }
    res.json({ success: true, vouchers, transactions: txs });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/:code/use', async (req, res) => {
  try {
    await db.updateAsync(data => {
      const v = data.vouchers.find(x => x.code === req.params.code);
      if (!v) throw new Error('Voucher not found');
      v.status = 'used'; v.usedAt = new Date().toISOString();
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/cleanup', async (req, res) => {
  try {
    const count = await db.updateAsync(data => {
      const before = data.vouchers.length;
      data.vouchers = data.vouchers.filter(v => v.status === 'unused');
      return before - data.vouchers.length;
    });
    res.json({ success: true, removed: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
