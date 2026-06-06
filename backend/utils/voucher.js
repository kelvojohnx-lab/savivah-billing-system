const db = require('../db');

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) c += '-';
    for (let j = 0; j < 4; j++) c += chars[Math.floor(Math.random() * chars.length)];
  }
  return c;
}

function durToSeconds(val, unit) {
  const map = { mins: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000 };
  return val * (map[unit] || 60);
}

function durLabel(val, unit) {
  return `${val} ${unit}`;
}

function createVoucher(pkgId, source = 'manual', txRef = null) {
  return db.update(data => {
    const pkg = data.packages.find(p => p.id === pkgId && p.active);
    if (!pkg) throw new Error('Package not found');
    const code = genCode();
    const voucher = {
      id: data._voucherCounter++,
      code,
      pkgId,
      pkgName: pkg.name,
      price: pkg.price,
      dur: durLabel(pkg.durVal, pkg.durUnit),
      durSeconds: durToSeconds(pkg.durVal, pkg.durUnit),
      speed: pkg.speed,
      profile: pkg.profile,
      data: pkg.data,
      status: 'unused',
      source,
      txRef,
      createdAt: new Date().toISOString(),
      usedAt: null,
      pushedToRouter: false,
    };
    data.vouchers.push(voucher);
    return voucher;
  });
}

function createTransaction(voucher, paymentMethod = 'manual', mpesaRef = null) {
  return db.update(data => {
    const tx = {
      id: Date.now(),
      code: voucher.code,
      pkgId: voucher.pkgId,
      pkgName: voucher.pkgName,
      amount: voucher.price,
      dur: voucher.dur,
      paymentMethod,
      mpesaRef,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    data.transactions.push(tx);
    return tx;
  });
}

module.exports = { genCode, createVoucher, createTransaction, durToSeconds };
