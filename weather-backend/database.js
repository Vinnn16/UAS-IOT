const low    = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path   = require('path');

const adapter = new FileSync(path.join(__dirname, 'weather.json'));
const db      = low(adapter);

// Set default struktur
db.defaults({ records: [] }).write();

console.log('[DB] Database siap — weather.json');

module.exports = {

  insert(temperature, humidity, condition, led) {
    const now = new Date();
    const created_at = now.toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
    const id = Date.now();

    db.get('records')
      .push({ id, temperature, humidity, condition, led, created_at })
      .write();

    // Batasi hanya simpan 1000 data terakhir
    const all = db.get('records').value();
    if (all.length > 1000) {
      db.set('records', all.slice(-1000)).write();
    }

    console.log('[DB] Data disimpan:', { temperature, humidity, condition, led });
    return id;
  },

  getLatest() {
    const records = db.get('records').value();
    if (!records.length) return null;
    return records[records.length - 1];
  },

  getHistory(limit = 20) {
    const records = db.get('records').value();
    return records.slice(-limit).reverse();
  },

  getStats() {
    const records = db.get('records').value();
    if (!records.length) return { message: 'Belum ada data' };

    const temps = records.map(r => parseFloat(r.temperature));
    const hums  = records.map(r => parseFloat(r.humidity));
    const avg   = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      total_data:   records.length,
      avg_temp:     parseFloat(avg(temps).toFixed(1)),
      min_temp:     parseFloat(Math.min(...temps).toFixed(1)),
      max_temp:     parseFloat(Math.max(...temps).toFixed(1)),
      avg_hum:      parseFloat(avg(hums).toFixed(1)),
      min_hum:      parseFloat(Math.min(...hums).toFixed(1)),
      max_hum:      parseFloat(Math.max(...hums).toFixed(1)),
      count_hot:    records.filter(r => r.condition === 'HOT').length,
      count_normal: records.filter(r => r.condition === 'NORMAL').length,
      count_cold:   records.filter(r => r.condition === 'COLD').length,
    };
  },

};
