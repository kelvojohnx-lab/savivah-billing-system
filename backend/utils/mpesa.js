const axios = require('axios');
const db = require('../db');

function getMpesaConfig() {
  const s = db.get().settings;
  return {
    shortcode: s.mpesa_shortcode,
    consumerKey: s.mpesa_consumer_key,
    consumerSecret: s.mpesa_consumer_secret,
    passkey: s.mpesa_passkey,
    callbackUrl: s.mpesa_callback_url,
    env: s.mpesa_env || 'sandbox',
  };
}

function getBaseUrl(env) {
  return env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

// Get OAuth access token
async function getAccessToken() {
  const cfg = getMpesaConfig();
  if (!cfg.consumerKey || !cfg.consumerSecret) {
    throw new Error('M-Pesa consumer key/secret not configured');
  }
  const creds = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  const res = await axios.get(
    `${getBaseUrl(cfg.env)}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${creds}` }, timeout: 10000 }
  );
  return res.data.access_token;
}

// Generate password & timestamp for STK push
function generatePassword(shortcode, passkey) {
  const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const raw = `${shortcode}${passkey}${ts}`;
  return {
    password: Buffer.from(raw).toString('base64'),
    timestamp: ts,
  };
}

// Initiate STK Push
async function stkPush({ phone, amount, pkgId, pkgName, orderId }) {
  const cfg = getMpesaConfig();

  if (!cfg.shortcode || !cfg.consumerKey || !cfg.passkey) {
    throw new Error('M-Pesa not fully configured. Please add shortcode, consumer key, and passkey in Settings.');
  }

  // Normalize phone: 07... → 2547...
  let msisdn = phone.toString().replace(/\s/g, '');
  if (msisdn.startsWith('0')) msisdn = '254' + msisdn.slice(1);
  if (msisdn.startsWith('+')) msisdn = msisdn.slice(1);

  const token = await getAccessToken();
  const { password, timestamp } = generatePassword(cfg.shortcode, cfg.passkey);
  const callbackUrl = cfg.callbackUrl || `https://yourdomain.com/api/mpesa/callback`;

  const payload = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount),
    PartyA: msisdn,
    PartyB: cfg.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: callbackUrl,
    AccountReference: `SAVIVAH-${orderId}`,
    TransactionDesc: `${pkgName} WiFi Package`,
  };

  const res = await axios.post(
    `${getBaseUrl(cfg.env)}/mpesa/stkpush/v1/processrequest`,
    payload,
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
  );

  return res.data;
}

// Validate STK callback and extract payment data
function parseCallback(body) {
  try {
    const stk = body.Body?.stkCallback;
    if (!stk) return null;
    const resultCode = stk.ResultCode;
    const checkoutId = stk.CheckoutRequestID;
    const merchantRef = stk.MerchantRequestID;

    if (resultCode !== 0) {
      return { success: false, resultCode, checkoutId, message: stk.ResultDesc };
    }

    const items = stk.CallbackMetadata?.Item || [];
    const get = (name) => items.find(i => i.Name === name)?.Value;

    return {
      success: true,
      resultCode,
      checkoutId,
      merchantRef,
      amount: get('Amount'),
      mpesaRef: get('MpesaReceiptNumber'),
      phone: get('PhoneNumber'),
      transactionDate: get('TransactionDate'),
    };
  } catch {
    return null;
  }
}

module.exports = { stkPush, parseCallback, getAccessToken };
