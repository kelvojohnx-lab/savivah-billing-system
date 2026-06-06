const router = require('express').Router();
const db = require('../db');
const { stkPush, parseCallback } = require('../utils/mpesa');
const { createVoucher, createTransaction } = require('../utils/voucher');
const { pushVoucherToMikrotik } = require('../utils/mikrotik');

// Initiate STK Push payment
router.post('/stk', async (req, res) => {
  try {
    const { phone, pkgId } = req.body;
    if (!phone || !pkgId) return res.status(400).json({ success: false, error: 'Phone and package required' });

    const d = await db.getAsync();
    const pkg = d.packages.find(p => p.id === Number(pkgId) && p.active);
    if (!pkg) return res.status(400).json({ success: false, error: 'Package not found' });

    const orderId = `${Date.now()}`;
    const result = await stkPush({ phone, amount: pkg.price, pkgId: pkg.id, pkgName: pkg.name, orderId });

    if (result.ResponseCode !== '0') {
      return res.status(400).json({ success: false, error: result.ResponseDescription });
    }

    await db.updateAsync(data => {
      data.mpesa_pending = data.mpesa_pending || [];
      data.mpesa_pending.push({
        checkoutId: result.CheckoutRequestID,
        merchantRef: result.MerchantRequestID,
        orderId, pkgId: pkg.id, phone, amount: pkg.price,
        createdAt: new Date().toISOString(),
      });
    });

    res.json({ success: true, message: 'STK push sent. Enter M-Pesa PIN on your phone.', checkoutId: result.CheckoutRequestID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Poll payment status
router.get('/status/:checkoutId', async (req, res) => {
  const d = await db.getAsync();
  const pending = (d.mpesa_pending || []).find(p => p.checkoutId === req.params.checkoutId);
  if (!pending) {
    const voucher = d.vouchers.find(v => v.txRef === req.params.checkoutId);
    if (voucher) return res.json({ success: true, status: 'completed', voucher });
    return res.json({ success: true, status: 'not_found' });
  }
  res.json({ success: true, status: 'pending' });
});

// M-Pesa Callback — Safaricom posts here after payment
router.post('/callback', async (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Always respond immediately
  try {
    const payment = parseCallback(req.body);
    if (!payment) return;

    const d = await db.getAsync();
    const pending = (d.mpesa_pending || []).find(p => p.checkoutId === payment.checkoutId);
    if (!pending) return;

    if (!payment.success) {
      await db.updateAsync(data => {
        data.mpesa_pending = (data.mpesa_pending || []).filter(p => p.checkoutId !== payment.checkoutId);
      });
      return;
    }

    const voucher = createVoucher(pending.pkgId, 'mpesa', payment.checkoutId);
    createTransaction(voucher, 'mpesa', payment.mpesaRef);

    await db.updateAsync(data => {
      const v = data.vouchers.find(x => x.code === voucher.code);
      if (v) { v.mpesaRef = payment.mpesaRef; v.phone = payment.phone; }
      data.mpesa_pending = (data.mpesa_pending || []).filter(p => p.checkoutId !== payment.checkoutId);
    });

    await pushVoucherToMikrotik(voucher);
    console.log(`✅ M-Pesa confirmed: ${payment.mpesaRef} → voucher ${voucher.code}`);
  } catch (err) {
    console.error('Callback error:', err.message);
  }
});

// Simulate payment (sandbox testing)
router.post('/simulate-payment', async (req, res) => {
  try {
    const { checkoutId } = req.body;
    const d = await db.getAsync();
    const pending = (d.mpesa_pending || []).find(p => p.checkoutId === checkoutId);
    if (!pending) return res.status(404).json({ success: false, error: 'Pending payment not found' });

    const voucher = createVoucher(pending.pkgId, 'mpesa', checkoutId);
    const tx = createTransaction(voucher, 'mpesa', 'SIM' + Date.now());

    await db.updateAsync(data => {
      const v = data.vouchers.find(x => x.code === voucher.code);
      if (v) v.mpesaRef = 'SIMULATED';
      data.mpesa_pending = (data.mpesa_pending || []).filter(p => p.checkoutId !== checkoutId);
    });

    const routerResult = await pushVoucherToMikrotik(voucher);
    res.json({ success: true, voucher, transaction: tx, routerPush: routerResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
