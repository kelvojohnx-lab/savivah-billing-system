const fs = require('fs');
const path = require('path');

// Use JSON file as lightweight DB (no native build needed)
const DB_PATH = path.join(__dirname, '../data/savivah.json');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const defaultData = {
  settings: {
    business_name: 'Savivah Internet Solutions',
    mpesa_shortcode: '',
    mpesa_consumer_key: '',
    mpesa_consumer_secret: '',
    mpesa_passkey: '',
    mpesa_callback_url: '',
    mpesa_env: 'sandbox',
    mikrotik_ip: '',
    mikrotik_port: '8728',
    mikrotik_user: 'admin',
    mikrotik_pass: '',
    mikrotik_hotspot_server: 'hotspot1',
    router_type: 'mikrotik'
  },
  packages: [
    { id: 1, name: 'Flash Browse', price: 5,    durVal: 20, durUnit: 'mins',  speed: '512K/512K', data: 'unlimited', profile: 'flash',   active: true },
    { id: 2, name: 'Quick Hour',   price: 20,   durVal: 1,  durUnit: 'hours', speed: '1M/1M',     data: 'unlimited', profile: 'hour',    active: true },
    { id: 3, name: 'Half Day',     price: 50,   durVal: 6,  durUnit: 'hours', speed: '2M/2M',     data: 'unlimited', profile: 'halfday', active: true },
    { id: 4, name: 'Full Day',     price: 100,  durVal: 1,  durUnit: 'days',  speed: '2M/2M',     data: 'unlimited', profile: 'day',     active: true },
    { id: 5, name: 'Weekly',       price: 500,  durVal: 7,  durUnit: 'days',  speed: '5M/5M',     data: '5G',        profile: 'weekly',  active: true },
    { id: 6, name: 'Monthly',      price: 1500, durVal: 30, durUnit: 'days',  speed: '10M/10M',   data: 'unlimited', profile: 'monthly', active: true },
  ],
  vouchers: [],
  transactions: [],
  mpesa_pending: [],
  _pkgCounter: 7,
  _voucherCounter: 1,
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    save(defaultData);
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function get() { return load(); }
function set(data) { save(data); return data; }
function update(fn) { const d = load(); const r = fn(d); save(d); return r; }

module.exports = { get, set, update, path: DB_PATH };
