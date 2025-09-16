#include <Arduino.h>
#include <WiFi.h>
#include "led_controller.h"
#include "poller.h"
#include "wifi-config.h"

void setup() {
  Serial.begin(115200);

  Serial.println(API_BASE_URL);
  Serial.println(CANVAS_ID);
  
  WiFi.setSleep(false); // Disable WiFi sleep for faster connection

  const unsigned long perNetworkTimeoutMs = 5000; // 10s per SSID
  bool connected = false;

  for (int i = 0; i < WIFI_CREDENTIALS_COUNT && !connected; i++) {
    const char* candidateSsid = WIFI_CREDENTIALS[i].ssid;
    const char* candidatePassword = WIFI_CREDENTIALS[i].password;

    Serial.print("Attempting WiFi: ");
    Serial.println(candidateSsid);

    WiFi.disconnect(true, true); // disconnect and erase old config
    delay(100);
    WiFi.begin(candidateSsid, candidatePassword);

    unsigned long startAttempt = millis();
    Serial.print("Connecting");
    while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < perNetworkTimeoutMs) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("");

    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      Serial.print("Connected to ");
      Serial.println(candidateSsid);
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.print("Failed to connect to ");
      Serial.print(candidateSsid);
      Serial.println(" within timeout");
    }
  }

  if (!connected) {
    Serial.println("No configured WiFi networks available. Device will continue running offline.");
  }
  
  // Initialize LED system
  led_init();
  
  // Give system time to stabilize
  delay(100);

  // Initialize poller (tick will be called from loop)
  poller_init();
}

void loop() {
  // Update fade effect
  led_update_fade();

  // Block polling during any fade (in or out) to keep animation smooth
  if (!led_is_animating()) {
    poller_tick();
  }
}
