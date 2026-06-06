const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  const d = await db.getAsync();
  const s = { ...d.settings };
  if (s.mpesa_consumer_secret) s.mpesa_consumer_secret = '••••••••';
  if (s.mikrotik_pass) s.mikrotik_pass = '••••••••';
  res.json({ success: true, settings: s });
});

router.post('/', async (req, res) => {
  try {
    await db.updateAsync(data => {
      const updates = req.body;
      if (updates.mpesa_consumer_secret === '••••••••') delete updates.mpesa_consumer_secret;
      if (updates.mikrotik_pass === '••••••••') delete updates.mikrotik_pass;
      Object.assign(data.settings, updates);
    });
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
