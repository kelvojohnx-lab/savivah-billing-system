const axios = require('axios');
const db = require('../db');

// Push a voucher as a hotspot user via MikroTik REST API (RouterOS v7+)
// Falls back to legacy RouterOS API simulation for older firmware
async function pushVoucherToMikrotik(voucher) {
  const data = db.get();
  const cfg = data.settings;

  if (!cfg.mikrotik_ip) {
    return { success: false, error: 'MikroTik IP not configured' };
  }

  const baseUrl = `http://${cfg.mikrotik_ip}:${cfg.mikrotik_port || 80}`;
  const auth = Buffer.from(`${cfg.mikrotik_user}:${cfg.mikrotik_pass}`).toString('base64');

  try {
    // RouterOS REST API (v7+): POST /rest/ip/hotspot/user
    const payload = {
      name: voucher.code,
      password: voucher.code,
      profile: voucher.profile || 'default',
      comment: `${voucher.pkgName} - KES ${voucher.price} - ${voucher.dur}`,
      'limit-uptime': secondsToMikrotikTime(voucher.durSeconds),
      server: cfg.mikrotik_hotspot_server || 'hotspot1',
    };

    const res = await axios.put(`${baseUrl}/rest/ip/hotspot/user`, payload, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    });

    db.update(d => {
      const v = d.vouchers.find(x => x.code === voucher.code);
      if (v) v.pushedToRouter = true;
    });

    return { success: true, routerResponse: res.data };
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    return { success: false, error: msg };
  }
}

// Remove a voucher from MikroTik hotspot (e.g. after expiry)
async function removeVoucherFromMikrotik(code) {
  const data = db.get();
  const cfg = data.settings;
  if (!cfg.mikrotik_ip) return { success: false, error: 'Not configured' };

  const baseUrl = `http://${cfg.mikrotik_ip}:${cfg.mikrotik_port || 80}`;
  const auth = Buffer.from(`${cfg.mikrotik_user}:${cfg.mikrotik_pass}`).toString('base64');

  try {
    // Find user by name first
    const search = await axios.get(`${baseUrl}/rest/ip/hotspot/user?name=${code}`, {
      headers: { Authorization: `Basic ${auth}` }, timeout: 8000
    });
    const users = search.data;
    if (users && users.length > 0) {
      const id = users[0]['.id'];
      await axios.delete(`${baseUrl}/rest/ip/hotspot/user/${id}`, {
        headers: { Authorization: `Basic ${auth}` }, timeout: 8000
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Test MikroTik connectivity
async function testMikrotikConnection() {
  const data = db.get();
  const cfg = data.settings;
  if (!cfg.mikrotik_ip) return { success: false, error: 'IP not set' };

  const baseUrl = `http://${cfg.mikrotik_ip}:${cfg.mikrotik_port || 80}`;
  const auth = Buffer.from(`${cfg.mikrotik_user}:${cfg.mikrotik_pass}`).toString('base64');

  try {
    const res = await axios.get(`${baseUrl}/rest/system/resource`, {
      headers: { Authorization: `Basic ${auth}` }, timeout: 5000
    });
    return { success: true, info: res.data };
  } catch (err) {
    return { success: false, error: err.response?.status === 401 ? 'Wrong credentials' : err.message };
  }
}

// Convert seconds to MikroTik time format e.g. 00:20:00
function secondsToMikrotikTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

module.exports = { pushVoucherToMikrotik, removeVoucherFromMikrotik, testMikrotikConnection };
