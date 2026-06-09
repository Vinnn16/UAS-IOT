const express = require('express');
const cors    = require('cors');
const mqtt    = require('mqtt');
const https   = require('https');
const db      = require('./database');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ── API Key ───────────────────────────────────────
const API_KEY = 'weatheriot-uas-2024-evin';

function checkApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key || key !== API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API Key tidak valid. Sertakan header x-api-key.'
    });
  }
  next();
}

// ── Telegram ──────────────────────────────────────
const TG_TOKEN   = '8891049640:AAHjc-60sRE4HNcuenNCG4tjhmQY9-dvYvI';
const TG_CHAT_ID = '6853837025';
let lastAlertTime = 0;

function sendTelegram(message) {
  const text = encodeURIComponent(message);
  const url  = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${text}&parse_mode=HTML`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const r = JSON.parse(data);
      if (r.ok) console.log('[TELEGRAM] Terkirim!');
      else      console.error('[TELEGRAM] Gagal:', r.description);
    });
  }).on('error', e => console.error('[TELEGRAM] Error:', e.message));
}

// ── MQTT ──────────────────────────────────────────
const MQTT_URL  = 'mqtts://4e9915438f754b09bd2050dd64722cda.s1.eu.hivemq.cloud:8883';
const MQTT_OPTS = {
  username:           'evin',
  password:           'espevin123',
  clientId:           'nodejs-backend-' + Math.random().toString(16).slice(2),
  rejectUnauthorized: false,
};

const TOPIC_DATA    = 'iot/uasiot/weather';
const TOPIC_CONTROL = 'iot/uasiot/control';

const mqttClient = mqtt.connect(MQTT_URL, MQTT_OPTS);

mqttClient.on('connect', () => {
  console.log('[MQTT] Terhubung ke HiveMQ!');
  mqttClient.subscribe(TOPIC_DATA, err => {
    if (!err) console.log('[MQTT] Subscribe:', TOPIC_DATA);
  });
  sendTelegram(
    '🟢 <b>WeatherIoT Backend Online</b>\n' +
    '📡 Terhubung ke HiveMQ\n' +
    '🔐 API Key aktif\n' +
    '🕐 ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
  );
});

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const temp = parseFloat(data.temperature);
    const hum  = parseFloat(data.humidity);
    console.log('[DATA]', data);
    db.insert(data.temperature, data.humidity, data.condition, data.led);

    const now = Date.now();
    if (temp > 30 && (now - lastAlertTime) > 60000) {
      lastAlertTime = now;
      sendTelegram(
        '🔴 <b>ALERT: Suhu Terlalu Panas!</b>\n\n' +
        '🌡️ Suhu     : <b>' + temp.toFixed(1) + '°C</b>\n' +
        '💧 Humidity : ' + hum.toFixed(1) + '%\n' +
        '💡 LED      : ' + data.led + ' (GPIO 18)\n' +
        '📟 LCD      : WEATHER: HOT\n\n' +
        '⚠️ Suhu melebihi batas normal (>30°C)\n' +
        '🕐 ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
      );
    }
    if (temp < 15 && (now - lastAlertTime) > 60000) {
      lastAlertTime = now;
      sendTelegram(
        '🔵 <b>ALERT: Suhu Terlalu Dingin!</b>\n\n' +
        '🌡️ Suhu     : <b>' + temp.toFixed(1) + '°C</b>\n' +
        '💧 Humidity : ' + hum.toFixed(1) + '%\n' +
        '💡 LED      : ' + data.led + ' (GPIO 18)\n' +
        '📟 LCD      : WEATHER: COLD\n\n' +
        '⚠️ Suhu di bawah batas normal (<15°C)\n' +
        '🕐 ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
      );
    }
  } catch (e) {
    console.error('[ERROR]', e.message);
  }
});

mqttClient.on('error', err => console.error('[MQTT] Error:', err.message));

// ── Fungsi publish kontrol ke ESP32 ──────────────
function publishControl(command) {
  const payload = JSON.stringify({ led: command });
  mqttClient.publish(TOPIC_CONTROL, payload, { qos: 0 }, (err) => {
    if (err) console.error('[CTRL] Gagal publish:', err.message);
    else     console.log('[CTRL] Perintah dikirim:', payload);
  });
}

// ── REST API ──────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ name: 'WeatherIoT Backend', version: '1.0.0', status: 'running' });
});

app.get('/api/latest', checkApiKey, (req, res) => {
  const row = db.getLatest();
  if (!row) return res.json({ message: 'Belum ada data' });
  res.json(row);
});

app.get('/api/history', checkApiKey, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(db.getHistory(limit));
});

app.get('/api/stats', checkApiKey, (req, res) => {
  res.json(db.getStats());
});

// POST /api/control — kontrol LED dari dashboard
app.post('/api/control', checkApiKey, (req, res) => {
  const { command } = req.body;
  const validCmds = ['ON', 'OFF', 'AUTO'];
  if (!command || !validCmds.includes(command.toUpperCase())) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Command harus salah satu dari: ON, OFF, AUTO'
    });
  }
  const cmd = command.toUpperCase();
  publishControl(cmd);

  const desc = cmd === 'ON' ? 'LED dinyalakan manual' :
               cmd === 'OFF' ? 'LED dimatikan manual' :
               'LED kembali ke mode otomatis';

  console.log('[API] Kontrol LED:', cmd);
  res.json({ success: true, command: cmd, message: desc });
});

app.get('/api/test-telegram', checkApiKey, (req, res) => {
  sendTelegram(
    '🧪 <b>Test Notifikasi WeatherIoT</b>\n' +
    '✅ Telegram Bot berfungsi!\n' +
    '🔐 API Key valid\n' +
    '🕐 ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
  );
  res.json({ message: 'Notifikasi test dikirim!' });
});

// ── Start ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     Weather IoT Backend — Running             ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  GET  /api/latest        (protected)          ║');
  console.log('║  GET  /api/history       (protected)          ║');
  console.log('║  GET  /api/stats         (protected)          ║');
  console.log('║  POST /api/control       (protected)          ║');
  console.log('║  GET  /api/test-telegram (protected)          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
