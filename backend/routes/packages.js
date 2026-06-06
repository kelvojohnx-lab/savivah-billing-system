const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const d = db.get();
  res.json({ success: true, packages: d.packages.filter(p => p.active !== false) });
});

router.post('/', (req, res) => {
  try {
    const pkg = db.update(data => {
      const { name, price, durVal, durUnit, speed, data: dataLimit, profile, featured } = req.body;
      if (!name || !price || price < 5) throw new Error('Name required and price must be at least KES 5');
      const newPkg = {
        id: data._pkgCounter++,
        name, price: Number(price), durVal: Number(durVal), durUnit,
        speed: speed || '1M/1M', data: dataLimit || 'unlimited',
        profile: profile || name.toLowerCase().replace(/\s+/g,'-'),
        featured: !!featured, active: true,
        createdAt: new Date().toISOString(),
      };
      data.packages.push(newPkg);
      return newPkg;
    });
    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const pkg = db.update(data => {
      const p = data.packages.find(x => x.id === Number(req.params.id));
      if (!p) throw new Error('Package not found');
      Object.assign(p, req.body);
      return p;
    });
    res.json({ success: true, package: pkg });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.update(data => {
      const p = data.packages.find(x => x.id === Number(req.params.id));
      if (p) p.active = false;
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
