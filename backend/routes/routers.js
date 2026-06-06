const router = require('express').Router();
const db = require('../db');
const { testMikrotikConnection } = require('../utils/mikrotik');

router.get('/test', async (req, res) => {
  const result = await testMikrotikConnection();
  res.json(result);
});

router.get('/', (req, res) => {
  const d = db.get();
  res.json({ success: true, settings: d.settings });
});

module.exports = router;
