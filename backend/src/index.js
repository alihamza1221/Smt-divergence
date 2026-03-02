const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Telegram configuration (mutable - can be updated via API)
let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
let telegramChatId = process.env.TELEGRAM_CHAT_ID || '';

// TradingView webhook secret (optional - for security)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text()); // Handle text/plain from TradingView

// In-memory storage for alerts (persists as long as server is running)
const alertStore = new Map();

// Track all symbols that have received alerts (persists even after alert expires)
const knownSymbols = new Set();

// Default symbols to always show
const DEFAULT_SYMBOLS = ['BTCUSDT.P', 'ETHUSDT.P', 'BNBUSDT.P', 'SOLUSDT.P', 'SUIUSDT.P', 'XRPUSDT.P'];
DEFAULT_SYMBOLS.forEach(s => knownSymbols.add(s));

// Settings
let expiryMinutes = 15;
let telegramAlertsEnabled = true;
let allowedAlertTimeframes = ['5m', '15m', '30m']; // Default timeframes for Telegram alerts

// Send Telegram message
async function sendTelegramAlert(alert) {
  if (!telegramAlertsEnabled) {
    console.log('📵 Telegram alerts disabled, skipping...');
    return;
  }

  // Check if timeframe is in allowed list
  if (!allowedAlertTimeframes.includes(alert.timeframe)) {
    console.log(`⏱️ Timeframe ${alert.timeframe} not in allowed list [${allowedAlertTimeframes.join(', ')}], skipping Telegram...`);
    return;
  }

  if (!telegramBotToken || telegramBotToken === 'your_bot_token_here' || 
      !telegramChatId || telegramChatId === 'your_chat_id_here') {
    console.log('⚠️ Telegram not configured, skipping alert...');
    return;
  }

  const emoji = alert.cvd_direction === 'bullish' ? '🟢' : '🔴';
  const direction = alert.cvd_direction.toUpperCase();
  const targetPrice = alert.cvd_direction === 'bullish' ? alert.session_low : alert.session_high;

  const message = `
${emoji} *CVD DIVERGENCE ALERT* ${emoji}

*Symbol:* ${alert.symbol}
*Timeframe:* ${alert.timeframe}
*Direction:* ${direction}
*Session:* ${alert.active_session || 'N/A'}

💰 *Target Price:* $${targetPrice.toLocaleString()}
📊 *L1:* $${alert.pivot1.toLocaleString()}
📊 *L2:* $${alert.pivot2.toLocaleString()}

📈 Session High: $${alert.session_high.toLocaleString()}
📉 Session Low: $${alert.session_low.toLocaleString()}

${alert.message ? `📝 ${alert.message}` : ''}
`.trim();

  try {
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    const data = await response.json();
    if (data.ok) {
      console.log('📨 Telegram alert sent successfully!');
    } else {
      console.error('❌ Telegram error:', data.description);
    }
  } catch (error) {
    console.error('❌ Failed to send Telegram alert:', error.message);
  }
}

// Helper function to clean expired alerts
function cleanExpiredAlerts() {
  const now = Date.now();
  const expiryMs = expiryMinutes * 60 * 1000;
  
  for (const [key, alert] of alertStore.entries()) {
    if (now - alert.receivedAt > expiryMs) {
      alertStore.delete(key);
      console.log(`Expired alert removed: ${key}`);
    }
  }
}

// Clean expired alerts every minute
setInterval(cleanExpiredAlerts, 60 * 1000);

// POST /api/cvd-alerts - Receive new alert from strategy
app.post('/api/cvd-alerts', (req, res) => {
  try {
    const body = req.body;
    
    console.log('Received CVD alert:', JSON.stringify(body, null, 2));
    
    const {
      message,
      symbol,
      timeframe,
      time,
      session_high,
      session_low,
      active_session,
      cvd_direction,
      pivot1,
      pivot2,
      isDivWithSweep,
      previous_session,
      exchange,
    } = body;

    if (!symbol || !timeframe) {
      return res.status(400).json({ error: 'symbol and timeframe are required' });
    }

    // Use exact symbol as provided (just uppercase it)
    const normalizedSymbol = symbol.toUpperCase();
    
    const key = `${normalizedSymbol}-${timeframe}`;
    
    const alert = {
      symbol: normalizedSymbol,
      timeframe,
      time: time || new Date().toISOString(),
      session_high: parseFloat(session_high) || 0,
      session_low: parseFloat(session_low) || 0,
      active_session: active_session || '',
      previous_session: previous_session || '',
      isDivWithSweep: isDivWithSweep === true || isDivWithSweep === 'true',
      cvd_direction: cvd_direction?.toLowerCase() === 'bullish' ? 'bullish' : 'bearish',
      pivot1: parseFloat(pivot1) || 0,
      pivot2: parseFloat(pivot2) || 0,
      message: message || '',
      exchange: exchange ? exchange.toUpperCase() : '',
      receivedAt: Date.now(),
    };

    alertStore.set(key, alert);
    
    // Track this symbol
    if (!knownSymbols.has(alert.symbol)) {
      knownSymbols.add(alert.symbol);
      console.log(`📌 New symbol added: ${alert.symbol}`);
    }
    
    console.log(`✅ Alert stored: ${key}`);
    console.log(`   Symbol: ${alert.symbol}, Timeframe: ${alert.timeframe}, Direction: ${alert.cvd_direction}`);
    console.log(`   Total alerts in store: ${alertStore.size}`);
    console.log(`   Known symbols: ${Array.from(knownSymbols).join(', ')}`);

    // Send Telegram notification
    sendTelegramAlert(alert);

    res.json({ success: true, key, alert });
  } catch (error) {
    console.error('Error processing POST request:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /webhook - TradingView webhook endpoint
app.post('/webhook', (req, res) => {
  try {
    console.log('📡 TradingView webhook received');

    // Optional: Validate webhook secret if configured
    if (WEBHOOK_SECRET) {
      const providedSecret = req.headers['x-webhook-secret'] || req.query.secret;
      if (providedSecret !== WEBHOOK_SECRET) {
        console.log('❌ Invalid webhook secret');
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
    }

    // Handle both JSON and text/plain content types
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseError) {
        console.log('❌ Failed to parse webhook body as JSON:', parseError.message);
        return res.status(400).json({ error: 'Invalid JSON in webhook body' });
      }
    }

    console.log('Parsed body:', JSON.stringify(body, null, 2));

    const {
      message,
      symbol,
      timeframe,
      session_high,
      session_low,
      active_session,
      cvd_direction,
      pivot1,
      pivot2,
      isDivWithSweep,
      previous_session,
      exchange,
    } = body;

    if (!symbol || !timeframe) {
      console.log('❌ Missing required fields: symbol or timeframe');
      return res.status(400).json({ error: 'symbol and timeframe are required' });
    }

    // Use exact symbol as provided (just uppercase it)
    const normalizedSymbol = symbol.toUpperCase();

    const key = `${normalizedSymbol}-${timeframe}`;

    const alert = {
      symbol: normalizedSymbol,
      timeframe,
      time: new Date().toISOString(),
      session_high: parseFloat(session_high) || 0,
      session_low: parseFloat(session_low) || 0,
      active_session: active_session || '',
      previous_session: previous_session || '',
      isDivWithSweep: isDivWithSweep === true || isDivWithSweep === 'true',
      cvd_direction: cvd_direction?.toLowerCase() === 'bullish' ? 'bullish' : 'bearish',
      pivot1: parseFloat(pivot1) || 0,
      pivot2: parseFloat(pivot2) || 0,
      message: message || '',
      exchange: exchange ? exchange.toUpperCase() : '',
      receivedAt: Date.now(),
    };

    alertStore.set(key, alert);

    // Track this symbol
    if (!knownSymbols.has(alert.symbol)) {
      knownSymbols.add(alert.symbol);
      console.log(`📌 New symbol added: ${alert.symbol}`);
    }

    console.log(`✅ TradingView alert stored: ${key}`);
    console.log(`   Symbol: ${alert.symbol}, Timeframe: ${alert.timeframe}, Direction: ${alert.cvd_direction}`);
    console.log(`   Session: ${alert.active_session}, Sweep: ${alert.isDivWithSweep}`);
    console.log(`   Total alerts in store: ${alertStore.size}`);

    // Send Telegram notification
    sendTelegramAlert(alert);

    // TradingView expects a 200 response
    res.status(200).json({ success: true, key, alert });
  } catch (error) {
    console.error('❌ Error processing TradingView webhook:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/cvd-alerts - Return all current alerts
app.get('/api/cvd-alerts', (req, res) => {
  try {
    // Clean expired alerts first
    cleanExpiredAlerts();
    
    // Convert Map to object
    const alerts = {};
    for (const [key, alert] of alertStore.entries()) {
      alerts[key] = alert;
    }

    console.log(`📤 Returning ${Object.keys(alerts).length} alerts`);

    res.json({ alerts });
  } catch (error) {
    console.error('Error processing GET request:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/cvd-alerts - Clear all alerts
app.delete('/api/cvd-alerts', (req, res) => {
  try {
    const count = alertStore.size;
    alertStore.clear();
    
    console.log(`🗑️ Cleared ${count} alerts`);

    res.json({ success: true, message: `All ${count} alerts cleared` });
  } catch (error) {
    console.error('Error processing DELETE request:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/symbols - Get all known symbols
app.get('/api/symbols', (req, res) => {
  // Return symbols sorted with defaults first, then alphabetically
  const defaultSet = new Set(DEFAULT_SYMBOLS);
  const additionalSymbols = Array.from(knownSymbols)
    .filter(s => !defaultSet.has(s))
    .sort();
  
  const symbols = [...DEFAULT_SYMBOLS, ...additionalSymbols];
  
  console.log(`📋 Returning ${symbols.length} symbols: ${symbols.join(', ')}`);
  res.json({ symbols, defaultSymbols: DEFAULT_SYMBOLS });
});

// GET /api/settings - Get current settings
app.get('/api/settings', (req, res) => {
  // Mask the bot token for security (show first 10 and last 5 chars)
  const maskedToken = telegramBotToken && telegramBotToken !== 'your_bot_token_here'
    ? telegramBotToken.slice(0, 10) + '...' + telegramBotToken.slice(-5)
    : '';
  
  res.json({ 
    expiryMinutes, 
    telegramAlertsEnabled, 
    allowedAlertTimeframes,
    telegramBotToken: maskedToken,
    telegramChatId: telegramChatId !== 'your_chat_id_here' ? telegramChatId : '',
    telegramConfigured: !!(telegramBotToken && telegramBotToken !== 'your_bot_token_here' && telegramChatId && telegramChatId !== 'your_chat_id_here')
  });
});

// PUT /api/settings - Update settings
app.put('/api/settings', (req, res) => {
  try {
    const { 
      expiryMinutes: newExpiry, 
      telegramAlertsEnabled: newTelegramEnabled, 
      allowedAlertTimeframes: newTimeframes,
      telegramBotToken: newBotToken,
      telegramChatId: newChatId
    } = req.body;
    
    if (newExpiry !== undefined && typeof newExpiry === 'number' && newExpiry > 0) {
      expiryMinutes = newExpiry;
      console.log(`⚙️ Expiry time updated to ${expiryMinutes} minutes`);
    }
    
    if (newTelegramEnabled !== undefined && typeof newTelegramEnabled === 'boolean') {
      telegramAlertsEnabled = newTelegramEnabled;
      console.log(`⚙️ Telegram alerts ${telegramAlertsEnabled ? 'enabled' : 'disabled'}`);
    }
    
    if (newTimeframes !== undefined && Array.isArray(newTimeframes)) {
      allowedAlertTimeframes = newTimeframes;
      console.log(`⚙️ Allowed alert timeframes updated to: [${allowedAlertTimeframes.join(', ')}]`);
    }
    
    if (newBotToken !== undefined && typeof newBotToken === 'string') {
      telegramBotToken = newBotToken;
      console.log(`⚙️ Telegram bot token updated`);
    }
    
    if (newChatId !== undefined && typeof newChatId === 'string') {
      telegramChatId = newChatId;
      console.log(`⚙️ Telegram chat ID updated`);
    }
    
    // Return masked token for security
    const maskedToken = telegramBotToken && telegramBotToken !== 'your_bot_token_here'
      ? telegramBotToken.slice(0, 10) + '...' + telegramBotToken.slice(-5)
      : '';
    
    res.json({ 
      success: true, 
      expiryMinutes, 
      telegramAlertsEnabled, 
      allowedAlertTimeframes,
      telegramBotToken: maskedToken,
      telegramChatId: telegramChatId !== 'your_chat_id_here' ? telegramChatId : '',
      telegramConfigured: !!(telegramBotToken && telegramBotToken !== 'your_bot_token_here' && telegramChatId && telegramChatId !== 'your_chat_id_here')
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', alertCount: alertStore.size, expiryMinutes, uptime: process.uptime() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 CVD Alerts Backend running on http://localhost:${PORT}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/api/cvd-alerts  - Receive alerts`);
  console.log(`   GET    http://localhost:${PORT}/api/cvd-alerts  - Get all alerts`);
  console.log(`   DELETE http://localhost:${PORT}/api/cvd-alerts  - Clear all alerts`);
  console.log(`   GET    http://localhost:${PORT}/api/symbols     - Get known symbols`);
  console.log(`   GET    http://localhost:${PORT}/api/settings    - Get settings`);
  console.log(`   PUT    http://localhost:${PORT}/api/settings    - Update settings`);
  console.log(`   GET    http://localhost:${PORT}/api/health      - Health check\n`);
});
