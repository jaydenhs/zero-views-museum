#include <Arduino.h>
#include <WiFi.h>
#include "led_controller.h"
#include "poller.h"
#include "wifi-config.h"

void setup() {
  Serial.begin(115200);

  Serial.println(API_BASE_URL);
  Serial.println(CANVAS_ID);
  
  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // Disable WiFi sleep for faster connection
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());
  
  // Initialize LED system
  led_init();
  
  // Give system time to stabilize
  delay(100);
}

void loop() {
  // Update fade effect
  led_update_fade();

  // Poll server periodically for state/image updates
  poller_tick();
}
