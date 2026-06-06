const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const d = db.get();
  // Never expose secret in GET (return masked)
  const s = { ...d.settings };
  if (s.mpesa_consumer_secret) s.mpesa_consumer_secret = '••••••••';
  if (s.mikrotik_pass) s.mikrotik_pass = '••••••••';
  res.json({ success: true, settings: s });
});

router.post('/', (req, res) => {
  try {
    db.update(data => {
      const updates = req.body;
      // Don't overwrite secrets if masked value is sent
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
