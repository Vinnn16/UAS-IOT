#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHTesp.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID  = "Wokwi-GUEST";
const char* WIFI_PASS  = "";

const char* MQTT_HOST      = "4e9915438f754b09bd2050dd64722cda.s1.eu.hivemq.cloud";
const int   MQTT_PORT      = 8883;
const char* MQTT_USER      = "evin";
const char* MQTT_PASS      = "espevin123";
const char* TOPIC_DATA     = "iot/uasiot/weather";        // publish data sensor
const char* TOPIC_CONTROL  = "iot/uasiot/control";        // subscribe perintah dari dashboard
const char* CLIENT_ID      = "ESP32-WeatherStation";

const int DHT_PIN = 15;
const int LED_PIN = 18;

LiquidCrystal_I2C lcd(0x27, 16, 2);
DHTesp dhtSensor;
WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

bool ledManualMode = false;  // false = otomatis, true = kontrol manual dari dashboard
bool ledManualState = false; // state LED saat mode manual

// ── Callback: terima perintah dari dashboard ──────
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("[CTRL] Perintah diterima: ");
  Serial.println(msg);

  StaticJsonDocument<100> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) { Serial.println("[CTRL] JSON error"); return; }

  String cmd = doc["led"] | "";

  if (cmd == "ON") {
    ledManualMode  = true;
    ledManualState = true;
    digitalWrite(LED_PIN, HIGH);
    lcd.setCursor(0, 1); lcd.print("LED: ON (Manual)");
    Serial.println("[CTRL] LED ON — mode manual");
  } else if (cmd == "OFF") {
    ledManualMode  = true;
    ledManualState = false;
    digitalWrite(LED_PIN, LOW);
    lcd.setCursor(0, 1); lcd.print("LED: OFF(Manual)");
    Serial.println("[CTRL] LED OFF — mode manual");
  } else if (cmd == "AUTO") {
    ledManualMode = false;
    Serial.println("[CTRL] LED kembali ke mode otomatis");
  }
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("WiFi Connected!");
  lcd.setCursor(0, 1); lcd.print(WiFi.localIP());
  delay(1500);
}

void connectMQTT() {
  wifiClient.setInsecure();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setSocketTimeout(15);
  mqttClient.setCallback(onMqttMessage);

  Serial.print("[MQTT] Connecting");
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Connecting MQTT");

  int tries = 0;
  while (!mqttClient.connected()) {
    tries++;
    Serial.print("\n[MQTT] Attempt "); Serial.print(tries);
    if (mqttClient.connect(CLIENT_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println(" -> Connected!");
      // Subscribe ke topic kontrol
      mqttClient.subscribe(TOPIC_CONTROL);
      Serial.println("[MQTT] Subscribe: " + String(TOPIC_CONTROL));
      lcd.clear();
      lcd.setCursor(0, 0); lcd.print("MQTT Connected!");
      lcd.setCursor(0, 1); lcd.print("Ready!");
      delay(1500);
    } else {
      Serial.print(" -> Failed rc="); Serial.println(mqttClient.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  dhtSensor.setup(DHT_PIN, DHTesp::DHT22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Weather System");
  lcd.setCursor(0, 1); lcd.print("UAS IoT ESP32");
  delay(2000);
  connectWiFi();
  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  TempAndHumidity data = dhtSensor.getTempAndHumidity();
  float temp = data.temperature;
  float hum  = data.humidity;

  // Kontrol LED — otomatis atau manual
  String condition;
  bool ledState;

  if (ledManualMode) {
    // Mode manual: ikuti perintah dari dashboard
    ledState  = ledManualState;
    condition = (temp > 30) ? "HOT" : (temp < 15) ? "COLD" : "NORMAL";
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  } else {
    // Mode otomatis: ikuti suhu
    if (temp > 30) {
      condition = "HOT";
      ledState  = true;
      digitalWrite(LED_PIN, HIGH);
    } else if (temp < 15) {
      condition = "COLD";
      ledState  = false;
      digitalWrite(LED_PIN, LOW);
    } else {
      condition = "NORMAL";
      ledState  = false;
      digitalWrite(LED_PIN, LOW);
    }
  }

  // Update LCD baris 1
  lcd.setCursor(0, 0);
  lcd.print("T:"); lcd.print(temp, 1);
  lcd.print("C H:"); lcd.print(hum, 0); lcd.print("%  ");

  // Update LCD baris 2 (hanya jika mode otomatis)
  if (!ledManualMode) {
    lcd.setCursor(0, 1);
    if (condition == "HOT")        lcd.print("WEATHER: HOT    ");
    else if (condition == "COLD")  lcd.print("WEATHER: COLD   ");
    else                           lcd.print("WEATHER: NORMAL ");
  }

  // Kirim data ke HiveMQ
  StaticJsonDocument<200> doc;
  doc["temperature"] = round(temp * 10) / 10.0;
  doc["humidity"]    = round(hum  * 10) / 10.0;
  doc["condition"]   = condition;
  doc["led"]         = ledState ? "ON" : "OFF";
  doc["led_mode"]    = ledManualMode ? "MANUAL" : "AUTO";

  char payload[200];
  serializeJson(doc, payload);
  bool sent = mqttClient.publish(TOPIC_DATA, payload);

  Serial.print("[DATA] T:"); Serial.print(temp, 1);
  Serial.print("C H:");      Serial.print(hum, 1);
  Serial.print("% | ");      Serial.print(condition);
  Serial.print(" | LED:");   Serial.print(ledState ? "ON" : "OFF");
  Serial.print(" | Mode:");  Serial.print(ledManualMode ? "MANUAL" : "AUTO");
  Serial.print(" | MQTT:");  Serial.println(sent ? "OK" : "GAGAL");

  delay(2000);
}
