#include "poller.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "led_controller.h"

static const unsigned long POLL_INTERVAL_MS = 500;
static unsigned long lastPollMs = 0;
static bool lastLookedAt = false;

static bool fetchState(bool &lookedAt) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  String url = String(API_BASE_URL) + "/api/canvas/" + CANVAS_ID + "/state";
  if (!https.begin(client, url)) return false;
  int code = https.GET();
  if (code != HTTP_CODE_OK) { https.end(); return false; }
  String payload = https.getString();
  https.end();
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload)) return false;
  lookedAt = doc["lookedAt"] | false;
  return true;
}

static bool fetchImageBytes(uint8_t *buffer, size_t expectedLen) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient https;
  String url = String(API_BASE_URL) + "/api/canvas/" + CANVAS_ID + "/imageBytes";
  if (!https.begin(client, url)) return false;
  int code = https.GET();
  if (code != HTTP_CODE_OK) { https.end(); return false; }
  WiFiClient *stream = https.getStreamPtr();
  size_t totalRead = 0;
  while (https.connected() && totalRead < expectedLen) {
    size_t avail = stream->available();
    if (avail) {
      size_t toRead = min(avail, expectedLen - totalRead);
      int readNow = stream->readBytes(reinterpret_cast<char*>(buffer + totalRead), toRead);
      if (readNow <= 0) break;
      totalRead += (size_t)readNow;
    } else {
      delay(5);
    }
  }
  https.end();
  return totalRead == expectedLen;
}

void poller_init() {
  lastPollMs = 0;
  lastLookedAt = false;
}

void poller_tick() {
  unsigned long now = millis();
  if (now - lastPollMs < POLL_INTERVAL_MS) return;
  lastPollMs = now;

  bool lookedAt = false;
  if (!fetchState(lookedAt)) return;

  if (lookedAt && !lastLookedAt) {
    size_t expected = led_expected_bytes();
    static uint8_t buffer[900 * 3]; // matches NUM_LEDS*3
    if (expected <= sizeof(buffer) && fetchImageBytes(buffer, expected)) {
      led_apply_bytes(buffer, expected);
    }
  } else if (!lookedAt && lastLookedAt) {
    led_fade_out_or_clear();
  }

  lastLookedAt = lookedAt;
}


