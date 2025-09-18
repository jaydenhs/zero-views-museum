#include "poller.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "led_controller.h"

static const int ONBOARD_LED_PIN = 2;
static const unsigned long POLL_INTERVAL_MS = 500; // polling cadence - increased for better cellular stability
static unsigned long lastPollMs = 0;
static bool lastLookedAt = false;

static bool fetchState(bool &lookedAt) {
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(3000); // 3 second timeout for state requests
  
  HTTPClient https;
  https.setTimeout(5000); // 5 second timeout for HTTP operations
  String url = String(API_BASE_URL) + "/api/canvas/" + CANVAS_ID + "/state";
  
  if (!https.begin(client, url)) {
    Serial.println("ERROR: Failed to begin state request");
    return false;
  }
  
  unsigned long startTime = millis();
  int code = https.GET();
  unsigned long getTime = millis() - startTime;
  
  Serial.print("code: ");
  Serial.print(code);
  Serial.print(" (took ");
  Serial.print(getTime);
  Serial.println(" ms)");
  
  if (code != HTTP_CODE_OK) { 
    Serial.print("ERROR: State request failed with code: ");
    Serial.println(code);
    https.end(); 
    return false; 
  }
  
  // Use getString() with timeout - simpler and more reliable
  startTime = millis();
  String payload = https.getString();
  unsigned long readTime = millis() - startTime;
  
  Serial.print("Response read in ");
  Serial.print(readTime);
  Serial.println(" ms");
  
  https.end();
  
  if (payload.length() == 0) {
    Serial.println("ERROR: Empty response from state endpoint");
    return false;
  }
  
  // Validate response length (should be around 50-100 chars for JSON with timestamp)
  if (payload.length() > 200) {
    Serial.print("WARNING: Response longer than expected: ");
    Serial.println(payload.length());
  }
  
  // Debug: Print the actual response
  Serial.print("Response length: ");
  Serial.println(payload.length());
  Serial.print("Response: ");
  Serial.println(payload);
  
  StaticJsonDocument<256> doc; // Increased size for timestamp field
  DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.print("ERROR: Failed to parse JSON response: ");
    Serial.println(error.c_str());
    Serial.print("Raw payload: ");
    Serial.println(payload);
    return false;
  }
  
  lookedAt = doc["lookedAt"] | false;
  long updatedAt = doc["updatedAt"] | 0;
  Serial.print("lookedAt: ");
  Serial.print(lookedAt);
  Serial.print(", updatedAt: ");
  Serial.println(updatedAt);
  return true;
}

static bool fetchImageBytes(uint8_t *buffer, size_t expectedLen) {
  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000); // 10 second timeout for SSL operations
  
  HTTPClient https;
  String url = String(API_BASE_URL) + "/api/canvas/" + CANVAS_ID + "/imageBytes";
  
  if (!https.begin(client, url)) {
    Serial.println("ERROR: Failed to begin HTTPS connection");
    return false;
  }
  
  https.setTimeout(15000); // 15 second timeout for HTTP operations
  int code = https.GET();
  
  if (code != HTTP_CODE_OK) { 
    Serial.print("ERROR: HTTP GET failed with code: ");
    Serial.println(code);
    https.end(); 
    return false; 
  }
  
  WiFiClient *stream = https.getStreamPtr();
  size_t totalRead = 0;
  unsigned long startTime = millis();
  const unsigned long maxReadTime = 30000; // 30 second max read time
  
  while (https.connected() && totalRead < expectedLen && (millis() - startTime) < maxReadTime) {
    size_t avail = stream->available();
    if (avail) {
      size_t toRead = min(avail, expectedLen - totalRead);
      int readNow = stream->readBytes(reinterpret_cast<char*>(buffer + totalRead), toRead);
      if (readNow <= 0) break;
      totalRead += (size_t)readNow;
      
      // Print progress every 10% for debugging
      if (expectedLen > 0 && (totalRead * 10 / expectedLen) != ((totalRead - readNow) * 10 / expectedLen)) {
        Serial.print("Progress: ");
        Serial.println((float)totalRead / expectedLen, 2);
      }
    } else {
      delay(5);
    }
  }
  
  https.end();
  
  bool success = totalRead == expectedLen;
  if (!success) {
    Serial.print("ERROR: Image download incomplete. Expected: ");
    Serial.print(expectedLen);
    Serial.print(", Read: ");
    Serial.println(totalRead);
  }
  
  return success;
}

void poller_init() {
  lastPollMs = 0;
  lastLookedAt = false;
}

void poller_tick() {
  unsigned long now = millis();
  if (now - lastPollMs < POLL_INTERVAL_MS) return;
  
  unsigned long pollStart = now;
  lastPollMs = now;

  Serial.print("[");
  Serial.print(now);
  Serial.println(" ms] poller tick");

  if (digitalRead(ONBOARD_LED_PIN) == LOW) {
    digitalWrite(ONBOARD_LED_PIN, HIGH);
  } else {
    digitalWrite(ONBOARD_LED_PIN, LOW);
  }

  bool lookedAt = false;
  if (!fetchState(lookedAt)) return;

  if (lookedAt && !lastLookedAt) {
    Serial.print("[");
    Serial.print(now);
    Serial.println(" ms] lookedAt changed: false -> true");
    size_t expected = led_expected_bytes();
    static uint8_t buffer[900 * 3]; // matches NUM_LEDS*3
    
    if (expected <= sizeof(buffer)) {
      // Retry image download up to 3 times for better reliability
      bool imageDownloaded = false;
      for (int retry = 0; retry < 3 && !imageDownloaded; retry++) {
        if (retry > 0) {
          Serial.print("Retrying image download (attempt ");
          Serial.print(retry + 1);
          Serial.println(")...");
          delay(1000); // Wait before retry
        }
        
        if (fetchImageBytes(buffer, expected)) {
          imageDownloaded = true;
          Serial.println("Image downloaded successfully");
          led_apply_bytes(buffer, expected);
        } else {
          Serial.print("Image download failed (attempt ");
          Serial.print(retry + 1);
          Serial.println(")");
        }
      }
      
      if (!imageDownloaded) {
        Serial.println("CRITICAL: Failed to download image after all retries");
        // Still trigger a fade-in with a fallback pattern or error indication
        led_fade_out_or_clear(); // Clear any existing state
      }
    } else {
      Serial.println("ERROR: Expected image size exceeds buffer capacity");
    }
  } else if (!lookedAt && lastLookedAt) {
    Serial.print("[");
    Serial.print(now);
    Serial.println(" ms] lookedAt changed: true -> false");
    led_fade_out_or_clear();
  }

  lastLookedAt = lookedAt;
  
  // Log timing information
  unsigned long pollDuration = millis() - pollStart;
  if (pollDuration > 1000) { // Only log if poll took more than 1 second
    Serial.print("WARNING: Poll took ");
    Serial.print(pollDuration);
    Serial.println(" ms");
  }
}


