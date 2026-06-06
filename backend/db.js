const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────
//  Dual-mode DB:
//  • DATABASE_URL present  →  PostgreSQL  (Render / production)
//  • No DATABASE_URL       →  JSON file   (local development)
// ─────────────────────────────────────────────────────────────

const USE_PG = !!process.env.DATABASE_URL;

// ── Default seed data ────────────────────────────────────────
const defaultData = {
  settings: {
    business_name:          'Savivah Internet Solutions',
    mpesa_shortcode:        '',
    mpesa_consumer_key:     '',
    mpesa_consumer_secret:  '',
    mpesa_passkey:          '',
    mpesa_callback_url:     '',
    mpesa_env:              'sandbox',
    mikrotik_ip:            '',
    mikrotik_port:          '80',
    mikrotik_user:          'admin',
    mikrotik_pass:          '',
    mikrotik_hotspot_server:'hotspot1',
    router_type:            'mikrotik',
  },
  packages: [
    { id:1, name:'Flash Browse', price:5,    durVal:20, durUnit:'mins',  speed:'512K/512K', data:'unlimited', profile:'flash',   active:true },
    { id:2, name:'Quick Hour',   price:20,   durVal:1,  durUnit:'hours', speed:'1M/1M',     data:'unlimited', profile:'hour',    active:true },
    { id:3, name:'Half Day',     price:50,   durVal:6,  durUnit:'hours', speed:'2M/2M',     data:'unlimited', profile:'halfday', active:true },
    { id:4, name:'Full Day',     price:100,  durVal:1,  durUnit:'days',  speed:'2M/2M',     data:'unlimited', profile:'day',     active:true },
    { id:5, name:'Weekly',       price:500,  durVal:7,  durUnit:'days',  speed:'5M/5M',     data:'5G',        profile:'weekly',  active:true },
    { id:6, name:'Monthly',      price:1500, durVal:30, durUnit:'days',  speed:'10M/10M',   data:'unlimited', profile:'monthly', active:true },
  ],
  vouchers:      [],
  transactions:  [],
  mpesa_pending: [],
  users:         [],
  _pkgCounter:   7,
  _voucherCounter: 1,
  _userCounter:  1,
};

// ════════════════════════════════════════════════════════════
//  POSTGRES MODE
// ════════════════════════════════════════════════════════════
let pgPool = null;

if (USE_PG) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required by Render
  });

  // Create the single key-value store table on first run
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS savivah_store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).then(() => {
    console.log('✅ PostgreSQL connected & table ready');
    // Seed default data if empty
    pgPool.query("SELECT value FROM savivah_store WHERE key='data'").then(r => {
      if (!r.rows.length) {
        pgPool.query(
          "INSERT INTO savivah_store(key,value) VALUES('data',$1)",
          [JSON.stringify(defaultData)]
        );
        console.log('✅ Database seeded with default data');
      }
    });
  }).catch(err => console.error('❌ PostgreSQL init error:', err.message));
}

// ── PG helpers (synchronous-style wrappers via callbacks) ────
async function pgLoad() {
  const r = await pgPool.query("SELECT value FROM savivah_store WHERE key='data'");
  if (!r.rows.length) return JSON.parse(JSON.stringify(defaultData));
  return JSON.parse(r.rows[0].value);
}

async function pgSave(data) {
  await pgPool.query(
    "INSERT INTO savivah_store(key,value) VALUES('data',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
    [JSON.stringify(data)]
  );
}

// ════════════════════════════════════════════════════════════
//  JSON FILE MODE (local)
// ════════════════════════════════════════════════════════════
const DB_PATH = path.join(__dirname, '../data/savivah.json');

if (!USE_PG) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function fileLoad() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    const d = JSON.parse(JSON.stringify(defaultData));
    fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2));
    return d;
  }
}

function fileSave(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ════════════════════════════════════════════════════════════
//  PUBLIC API  — same interface regardless of backend
// ════════════════════════════════════════════════════════════

// get() — returns data object
function get() {
  if (USE_PG) throw new Error('Use await getAsync() in PostgreSQL mode');
  return fileLoad();
}

async function getAsync() {
  if (USE_PG) return pgLoad();
  return fileLoad();
}

// update(fn) — fn receives data, mutates it, returns optional value
function update(fn) {
  if (USE_PG) throw new Error('Use await updateAsync(fn) in PostgreSQL mode');
  const d = fileLoad();
  const result = fn(d);
  fileSave(d);
  return result;
}

async function updateAsync(fn) {
  if (USE_PG) {
    const d = await pgLoad();
    const result = await fn(d);
    await pgSave(d);
    return result;
  }
  const d = fileLoad();
  const result = fn(d);
  fileSave(d);
  return result;
}

module.exports = {
  // Sync (local only — existing routes use these)
  get,
  update,
  // Async (works on both local + Render)
  getAsync,
  updateAsync,
  // Meta
  path: DB_PATH,
  isPostgres: USE_PG,
};
