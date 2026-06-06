# 📶 Savivah Internet Solutions — WiFi Billing System

Full-stack hotspot billing system with M-Pesa STK Push and MikroTik router integration.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install --ignore-scripts

# 2. Start the server
npm start

# 3. Open browser
http://localhost:3000
```

---

## ⚙️ Configuration (Settings Page)

### M-Pesa Daraja Setup
1. Go to **https://developer.safaricom.co.ke**
2. Create an app → get **Consumer Key** and **Consumer Secret**
3. Get your **Lipa na M-Pesa Passkey** from the Daraja portal
4. Enter your **Paybill/Till shortcode**
5. Set **Callback URL** to your public server URL:
   ```
   https://your-server.com/api/mpesa/callback
   ```
   > Use [ngrok](https://ngrok.com) for local testing: `ngrok http 3000`

### MikroTik Router Setup
1. Enable REST API in RouterOS:
   ```
   /ip service set www disabled=no port=80
   ```
2. Enter your router IP, port (80), username, password in Settings
3. Click **Test Connection** to verify

---

## 📁 Project Structure

```
savivah/
├── backend/
│   ├── server.js          # Express app entry
│   ├── db.js              # JSON file database
│   ├── routes/
│   │   ├── settings.js    # Business & API config
│   │   ├── packages.js    # WiFi packages CRUD
│   │   ├── vouchers.js    # Voucher generation
│   │   ├── transactions.js# Sales history
│   │   ├── mpesa.js       # STK Push + callback
│   │   └── hotspot.js     # MikroTik REST API push
│   └── utils/
│       ├── voucher.js     # Code generation logic
│       ├── mikrotik.js    # RouterOS REST API client
│       └── mpesa.js       # Daraja API wrapper
├── frontend/
│   └── public/
│       └── index.html     # Full SPA frontend
├── data/
│   └── savivah.json       # Auto-created database file
├── .env                   # Environment variables
└── package.json
```

---

## 💳 Payment Flow

```
Customer → connects to WiFi
        → browser redirected to hotspot login
        → calls you or sees payment info

You     → open Quick Sell
        → enter customer phone + select package
        → click "Send STK Push"

Customer → receives M-Pesa prompt on phone
         → enters PIN

System  → M-Pesa callback received
        → voucher auto-generated
        → pushed to MikroTik hotspot users
        → customer enters code on login page
        → internet access granted ✅
```

---

## 📦 Default Packages

| Name        | Price   | Duration | Speed     |
|-------------|---------|----------|-----------|
| Flash Browse| KES 5   | 20 mins  | 512K/512K |
| Quick Hour  | KES 20  | 1 hour   | 1M/1M     |
| Half Day    | KES 50  | 6 hours  | 2M/2M     |
| Full Day    | KES 100 | 1 day    | 2M/2M     |
| Weekly      | KES 500 | 7 days   | 5M/5M     |
| Monthly     | KES 1500| 30 days  | 10M/10M   |

---

## 🌐 API Endpoints

| Method | Endpoint                    | Description                  |
|--------|-----------------------------|------------------------------|
| GET    | /api/packages               | List all packages            |
| POST   | /api/packages               | Create package               |
| PUT    | /api/packages/:id           | Update package               |
| DELETE | /api/packages/:id           | Delete package               |
| GET    | /api/vouchers               | List vouchers                |
| POST   | /api/vouchers/generate      | Generate voucher(s)          |
| PATCH  | /api/vouchers/:code/use     | Mark voucher used            |
| DELETE | /api/vouchers/cleanup       | Remove used vouchers         |
| GET    | /api/transactions           | Sales history + summary      |
| POST   | /api/mpesa/stk              | Initiate STK Push            |
| GET    | /api/mpesa/status/:id       | Poll payment status          |
| POST   | /api/mpesa/callback         | Safaricom callback (webhook) |
| POST   | /api/mpesa/simulate-payment | Simulate payment (sandbox)   |
| GET    | /api/hotspot/test           | Test MikroTik connection     |
| POST   | /api/hotspot/push/:code     | Push voucher to router       |
| POST   | /api/hotspot/push-all       | Push all unpushed vouchers   |
| GET    | /api/settings               | Get settings                 |
| POST   | /api/settings               | Save settings                |

---

## 🔒 Security Notes

- Change MikroTik admin password before going live
- Use HTTPS for your callback URL in production
- Keep Consumer Secret and Passkey private
- Create a dedicated API user on MikroTik with limited permissions

---

## 🛠 Requirements

- Node.js 18+
- MikroTik router with RouterOS v7+ (REST API)
- Safaricom Daraja API account
- Public IP or domain for M-Pesa callback (use ngrok for local dev)
