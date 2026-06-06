const router = require('express').Router();
const db = require('../db');
const { createVoucher, createTransaction } = require('../utils/voucher');
const { pushVoucherToMikrotik } = require('../utils/mikrotik');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { phone, name, password } = req.body;
    if (!phone || !name) return res.status(400).json({ success: false, error: 'Name and phone required' });

    let msisdn = phone.toString().replace(/\s/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('+')) msisdn = msisdn.slice(1);

    const d = db.get();
    const users = d.users || [];
    if (users.find(u => u.phone === msisdn)) {
      return res.status(400).json({ success: false, error: 'Phone number already registered' });
    }

    const user = {
      id: (d._userCounter || 1),
      name: name.trim(),
      phone: msisdn,
      password: password || '',
      isNew: true,
      trialUsed: false,
      trialVoucher: null,
      registeredAt: new Date().toISOString(),
    };

    db.update(data => {
      data.users = data.users || [];
      data._userCounter = (data._userCounter || 1) + 1;
      data.users.push(user);
    });

    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, isNew: true, trialUsed: false } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    let { phone, password } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
    let msisdn = phone.toString().replace(/\s/g, '');
    if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
    if (msisdn.startsWith('+')) msisdn = msisdn.slice(1);

    const d = db.get();
    const users = d.users || [];
    const user = users.find(u => u.phone === msisdn);
    if (!user) return res.status(404).json({ success: false, error: 'Account not found. Please register first.' });
    if (user.password && password !== user.password) {
      return res.status(401).json({ success: false, error: 'Wrong password' });
    }

    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, trialUsed: user.trialUsed, trialVoucher: user.trialVoucher } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Claim free 3-day trial
router.post('/trial', async (req, res) => {
  try {
    const { userId } = req.body;
    const d = db.get();
    const users = d.users || [];
    const user = users.find(u => u.id === Number(userId));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.trialUsed) return res.status(400).json({ success: false, error: 'Free trial already used' });

    // Find or create the free trial package
    let trialPkg = d.packages.find(p => p.profile === 'free-trial' && p.active);
    if (!trialPkg) {
      db.update(data => {
        const pkg = {
          id: data._pkgCounter++,
          name: 'Free Trial',
          price: 0,
          durVal: 3,
          durUnit: 'days',
          speed: '1M/1M',
          data: '500M',
          profile: 'free-trial',
          featured: false,
          active: true,
          isTrial: true,
          createdAt: new Date().toISOString(),
        };
        data.packages.push(pkg);
        trialPkg = pkg;
      });
      trialPkg = db.get().packages.find(p => p.profile === 'free-trial');
    }

    const voucher = createVoucher(trialPkg.id, 'trial', null);
    // Mark trial used
    db.update(data => {
      const u = (data.users || []).find(x => x.id === Number(userId));
      if (u) { u.trialUsed = true; u.trialVoucher = voucher.code; u.isNew = false; }
    });

    // Push to router
    const routerResult = await pushVoucherToMikrotik(voucher);

    res.json({ success: true, voucher, routerPush: routerResult, message: 'Your 3-day free trial is ready!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get user info
router.get('/:id', (req, res) => {
  const d = db.get();
  const user = (d.users || []).find(u => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, trialUsed: user.trialUsed, trialVoucher: user.trialVoucher, registeredAt: user.registeredAt } });
});

module.exports = router;
