const router = require('express').Router();
const db = require('../db');
const { createVoucher, createTransaction } = require('../utils/voucher');
const { pushVoucherToMikrotik } = require('../utils/mikrotik');

router.post('/register', async (req, res) => {
  try {
    const { phone, name, password } = req.body;
    if (!phone || !name) return res.status(400).json({ success: false, error: 'Name and phone required' });
    let msisdn = phone.toString().replace(/\s/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('+')) msisdn = msisdn.slice(1);

    const existing = await db.getAsync();
    if ((existing.users || []).find(u => u.phone === msisdn))
      return res.status(400).json({ success: false, error: 'Phone number already registered' });

    const user = await db.updateAsync(data => {
      data.users = data.users || [];
      data._userCounter = data._userCounter || 1;
      const u = { id: data._userCounter++, name: name.trim(), phone: msisdn, password: password || '', trialUsed: false, trialVoucher: null, registeredAt: new Date().toISOString() };
      data.users.push(u);
      return u;
    });
    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, trialUsed: false } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    let { phone, password } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
    let msisdn = phone.toString().replace(/\s/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('+')) msisdn = msisdn.slice(1);
    const d = await db.getAsync();
    const user = (d.users || []).find(u => u.phone === msisdn);
    if (!user) return res.status(404).json({ success: false, error: 'Account not found. Please register first.' });
    if (user.password && password !== user.password) return res.status(401).json({ success: false, error: 'Wrong password' });
    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, trialUsed: user.trialUsed, trialVoucher: user.trialVoucher } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/trial', async (req, res) => {
  try {
    const { userId } = req.body;
    const d = await db.getAsync();
    const user = (d.users || []).find(u => u.id === Number(userId));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.trialUsed) return res.status(400).json({ success: false, error: 'Free trial already used' });

    let trialPkg = d.packages.find(p => p.profile === 'free-trial' && p.active);
    if (!trialPkg) {
      trialPkg = await db.updateAsync(data => {
        const pkg = { id: data._pkgCounter++, name: 'Free Trial', price: 0, durVal: 3, durUnit: 'days', speed: '1M/1M', data: '500M', profile: 'free-trial', featured: false, active: true, isTrial: true, createdAt: new Date().toISOString() };
        data.packages.push(pkg);
        return pkg;
      });
    }

    const voucher = createVoucher(trialPkg.id, 'trial', null);
    await db.updateAsync(data => {
      const u = (data.users || []).find(x => x.id === Number(userId));
      if (u) { u.trialUsed = true; u.trialVoucher = voucher.code; }
    });

    const routerResult = await pushVoucherToMikrotik(voucher);
    res.json({ success: true, voucher, routerPush: routerResult, message: 'Your 3-day free trial is ready!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const d = await db.getAsync();
  const user = (d.users || []).find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, trialUsed: user.trialUsed, trialVoucher: user.trialVoucher } });
});

module.exports = router;
