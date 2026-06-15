# WEATHER MONITORING SYSTEM
BERBASIS ESP32, MQTT, NODE JS, dan TELEGRAM BOT


![IoT](https://img.shields.io/badge/IoT-ESP32-orange)
![MQTT](https://img.shields.io/badge/Protocol-MQTT-blue)
![Node.js](https://img.shields.io/badge/Backend-Node.js-green)
![React](https://img.shields.io/badge/Dashboard-React.js-61dafb)
![HiveMQ](https://img.shields.io/badge/Broker-HiveMQ_Cloud-yellow)
![Telegram](https://img.shields.io/badge/Alert-Telegram_Bot-2CA5E0)

> Final Project Mata Kuliah Internet of Things (IoT)  
> Program Studi Teknik Informatika — Universitas Palangka Raya  

---

## Deskripsi Proyek

Sistem **Weather Monitoring System** berbasis IoT yang memantau suhu dan kelembapan secara real-time menggunakan ESP32 + DHT22, mengirimkan data via protokol MQTT ke broker HiveMQ Cloud, menyimpan data di backend Node.js, dan menampilkan visualisasi di dashboard web modern. Sistem juga dilengkapi notifikasi otomatis via Telegram Bot saat suhu melampaui ambang batas.

---

## Komponen & Teknologi

### Hardware (Wokwi Simulator)
| Komponen | Fungsi | Pin |
|---|---|---|
| ESP32 DevKit V1 | Mikrokontroler utama | — |
| DHT22 | Sensor suhu & kelembapan | GPIO 15 |
| LCD I2C 16x2 | Tampilan data lokal | SDA/SCL |
| LED Merah | Indikator suhu panas | GPIO 18 |

### Software & Layanan
| Layer | Teknologi |
|---|---|
| Firmware | Arduino C++ (ESP32) |
| Protokol | MQTT over TLS (port 8883) |
| Broker | HiveMQ Cloud (Free Tier) |
| Backend | Node.js + Express.js |
| Database | lowdb (JSON file-based) |
| Dashboard | React.js + Chart.js |
| Notifikasi | Telegram Bot API |
| Simulator | Wokwi |

---

## Struktur Folder

```
UAS-IOT/
│
├── weather-iot.html          # Dashboard web (React.js)
│
├── weather-backend/          # Backend Node.js
│   ├── server.js             # Entry point: MQTT + API + Telegram
│   ├── database.js           # Abstraksi database lowdb
│   ├── package.json          # Dependencies
│   └── weather.json          # File database (auto-generated)
│
├── sketch.ino                # Firmware ESP32 (Arduino)
└── README.md                 # Dokumentasi ini
```

---

## Cara Instalasi & Menjalankan

### Prasyarat
- Node.js v18+ terinstall
- Akun Wokwi (wokwi.com)
- Akun HiveMQ Cloud (hivemq.com)
- Akun Telegram + Bot Token

### 1. Clone Repository
```bash
git clone https://github.com/USERNAME/UAS-IOT.git
cd UAS-IOT
```

### 2. Install Dependencies Backend
```bash
cd weather-backend
npm install
```

### 3. Jalankan Backend
```bash
node server.js
```
Backend berjalan di `http://localhost:3000`

### 4. Jalankan Simulator Wokwi
- Buka [wokwi.com/projects/465145460461775873](https://wokwi.com/projects/465145460461775873)
- Klik tombol **Play**
- Tunggu Serial Monitor menampilkan `[MQTT] Connected!`

### 5. Buka Dashboard
- Buka file `weather-iot.html` di browser
- Banner akan berubah menjadi **DATA LIVE** jika backend aktif

---

## Konfigurasi MQTT

| Parameter | Nilai |
|---|---|
| Broker Host | `4e9915438f754b09bd2050dd64722cda.s1.eu.hivemq.cloud` |
| Port | `8883` (TLS/SSL) |
| Topic | `iot/uasiot/weather` |
| Username | `evin` |

---

## API Endpoints

Semua endpoint membutuhkan header autentikasi:
```
x-api-key: weatheriot-uas-2024-evin
```

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/latest` | Data sensor terbaru |
| GET | `/api/history?limit=N` | N data historis |
| GET | `/api/stats` | Statistik min/max/avg |
| GET | `/api/test-telegram` | Test notifikasi Telegram |
| GET | `/` | Info backend (public) |

### Contoh Request
```bash
curl -H "x-api-key: weatheriot-uas-2024-evin" http://localhost:3000/api/latest
```

### Contoh Response
```json
{
  "id": 1748563200000,
  "temperature": 28.5,
  "humidity": 68.4,
  "condition": "NORMAL",
  "led": "OFF",
  "created_at": "30/05/2026, 08.00.00"
}
```

---

## Logika Kondisi Cuaca & Alert

| Kondisi | Suhu | LED GPIO 18 | LCD | Telegram Alert |
|---|---|---|---|---|
| HOT | > 30°C | HIGH (ON) | WEATHER: HOT | Dikirim |
| NORMAL | 15–30°C | LOW (OFF) | WEATHER: NORMAL | Tidak Dikirim |
| COLD | < 15°C | LOW (OFF) | WEATHER: COLD | Dikirim |

> Alert Telegram memiliki cooldown 60 detik untuk mencegah spam notifikasi.

---

## Format Payload MQTT

Data dikirim dalam format JSON setiap 2 detik:
```json
{
  "temperature": 28.5,
  "humidity": 68.4,
  "condition": "NORMAL",
  "led": "OFF"
}
```

---

## Keamanan

- **API Key Authentication** — semua endpoint `/api/*` wajib menyertakan header `x-api-key`
- **TLS/SSL Encryption** — koneksi MQTT menggunakan port 8883 dengan enkripsi TLS
- **MQTT Credentials** — username dan password untuk koneksi broker HiveMQ
- **HTTP 401** — response otomatis jika API Key tidak valid atau tidak disertakan

---

## Hasil Pengujian

| Skenario | Status |
|---|---|
| Koneksi WiFi ESP32 (Wokwi-GUEST) | PASS |
| Koneksi MQTT ke HiveMQ (port 8883 TLS) | PASS |
| Pembacaan sensor DHT22 | PASS |
| Kondisi HOT — LED ON + Telegram alert | PASS |
| Kondisi COLD — LED OFF + Telegram alert | PASS |
| Kondisi NORMAL — LED OFF | PASS |
| API tanpa key → 401 Unauthorized | PASS |
| API dengan key valid → 200 OK | PASS |
| Dashboard fetch data real-time | PASS |
| Test notifikasi Telegram | PASS |

---

## Informasi Mahasiswa

| | |
|---|---|
| **Nama** | Elgi Juldrievin |
| **Program Studi** | Teknik Informatika |
| **Universitas** | Universitas Palangka Raya |
| **Mata Kuliah** | Internet of Things (IoT) |
| **Simulator** | [Wokwi Project]([https://wokwi.com/projects/465145460461775873](https://wokwi.com/projects/465145460461775873)) |

---
