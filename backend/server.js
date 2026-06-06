require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve hotspot portal (for MikroTik redirect)
app.use('/hotspot', express.static(path.join(__dirname, '../hotspot')));

// Serve admin dashboard
app.use(express.static(path.join(__dirname, '../frontend/public')));

// API Routes
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/packages',     require('./routes/packages'));
app.use('/api/vouchers',     require('./routes/vouchers'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/routers',      require('./routes/routers'));
app.use('/api/mpesa',        require('./routes/mpesa'));
app.use('/api/hotspot',      require('./routes/hotspot'));
app.use('/api/users',        require('./routes/users'));

// Fallback to admin
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`\n🌐 Savivah Internet Solutions`);
  console.log(`   Admin Panel  → http://localhost:${PORT}`);
  console.log(`   Hotspot Portal → http://localhost:${PORT}/hotspot/`);
  console.log(`   M-Pesa: ${process.env.MPESA_SHORTCODE ? '✅ Configured' : '⚠️ Not configured'}`);
  console.log(`   DB connected\n`);
});
});
