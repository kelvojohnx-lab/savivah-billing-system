const router = require('express').Router();
const { testMikrotikConnection, pushVoucherToMikrotik, removeVoucherFromMikrotik } = require('../utils/mikrotik');
const db = require('../db');

router.get('/test', async (req, res) => {
  const result = await testMikrotikConnection();
  res.json(result);
});

router.post('/push/:code', async (req, res) => {
  try {
    const d = db.get();
    const v = d.vouchers.find(x => x.code === req.params.code);
    if (!v) return res.status(404).json({ success: false, error: 'Voucher not found' });
    const result = await pushVoucherToMikrotik(v);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/remove/:code', async (req, res) => {
  const result = await removeVoucherFromMikrotik(req.params.code);
  res.json(result);
});

// Push all unpushed vouchers in batch
router.post('/push-all', async (req, res) => {
  const d = db.get();
  const unpushed = d.vouchers.filter(v => !v.pushedToRouter && v.status === 'unused');
  const results = [];
  for (const v of unpushed.slice(0, 100)) {
    results.push({ code: v.code, ...(await pushVoucherToMikrotik(v)) });
  }
  res.json({ success: true, pushed: results.length, results });
});

module.exports = router;
