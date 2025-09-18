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
  WiFi.mode(WIFI_STA); // Set to station mode explicitly

  // Scan for available networks for debugging
  Serial.println("Scanning for available networks...");
  int n = WiFi.scanNetworks();
  if (n == 0) {
    Serial.println("No networks found");
  } else {
    Serial.print(n);
    Serial.println(" networks found:");
    for (int i = 0; i < n; ++i) {
      Serial.print(i + 1);
      Serial.print(": ");
      Serial.print(WiFi.SSID(i));
      Serial.print(" (");
      Serial.print(WiFi.RSSI(i));
      Serial.print(" dBm) ");
      Serial.println((WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "open" : "encrypted");
    }
  }
  Serial.println("");

  const unsigned long perNetworkTimeoutMs = 15000; // Increased timeout for iPhone hotspots
  bool connected = false;
  int retryCount = 0;
  const int maxRetries = 3; // Maximum number of full retry cycles

  while (!connected && retryCount < maxRetries) {
    if (retryCount > 0) {
      Serial.print("Retry attempt ");
      Serial.print(retryCount);
      Serial.print(" of ");
      Serial.print(maxRetries);
      Serial.println(" - restarting WiFi scan and connection process...");
      delay(2000); // Wait before retrying
    }
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
        
        // Print status every 2 seconds for debugging
        if ((millis() - startAttempt) % 2000 < 500) {
          Serial.print(" [Status: ");
          Serial.print(WiFi.status());
          Serial.print("]");
        }
      }
      Serial.println("");

      if (WiFi.status() == WL_CONNECTED) {
        connected = true;
        Serial.print("Connected to ");
        Serial.println(candidateSsid);
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("Signal strength: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
      } else {
        Serial.print("Failed to connect to ");
        Serial.print(candidateSsid);
        Serial.print(" within timeout. Final status: ");
        Serial.println(WiFi.status());
        
      // Print common status codes for debugging
      switch(WiFi.status()) {
        case WL_NO_SSID_AVAIL: 
          Serial.println("  -> Network not found (check if hotspot is on and visible)");
          Serial.println("  -> Try: Settings > Personal Hotspot > Maximize Compatibility");
          break;
        case WL_CONNECT_FAILED: 
          Serial.println("  -> Connection failed (wrong password or security protocol)");
          break;
        case WL_CONNECTION_LOST: 
          Serial.println("  -> Connection lost (signal strength issue)");
          break;
        case WL_DISCONNECTED: 
          Serial.println("  -> Disconnected");
          break;
        case WL_IDLE_STATUS:
          Serial.println("  -> Idle (no connection attempt)");
          break;
        case WL_SCAN_COMPLETED:
          Serial.println("  -> Scan completed");
          break;
        default: 
          Serial.print("  -> Unknown error (code: ");
          Serial.print(WiFi.status());
          Serial.println(")");
          break;
      }
      }
    }

    if (!connected) {
      retryCount++;
      if (retryCount < maxRetries) {
        Serial.println("All networks failed. Retrying in 5 seconds...");
        delay(5000);
      }
    }
  }

  if (!connected) {
    Serial.println("CRITICAL: Failed to connect to any WiFi network after all retry attempts.");
    Serial.println("The device requires WiFi to function. Please check your network settings.");
    Serial.println("Restarting the device in 10 seconds...");
    delay(10000);
    ESP.restart(); // Restart the ESP32 to try again from the beginning
  }
  
  // Initialize LED system
  led_init();
  
  // Give system time to stabilize
  delay(100);

  // Initialize poller (tick will be called from loop)
  poller_init();
}

void loop() {
  // Check WiFi connection status and attempt reconnection if needed
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost! Attempting to reconnect...");
    WiFi.disconnect(true, true);
    delay(1000);
    
    // Try to reconnect to the first available network
    for (int i = 0; i < WIFI_CREDENTIALS_COUNT; i++) {
      const char* candidateSsid = WIFI_CREDENTIALS[i].ssid;
      const char* candidatePassword = WIFI_CREDENTIALS[i].password;
      
      Serial.print("Reconnecting to: ");
      Serial.println(candidateSsid);
      
      WiFi.begin(candidateSsid, candidatePassword);
      
      unsigned long startAttempt = millis();
      while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 10000) {
        delay(500);
        Serial.print(".");
      }
      
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Reconnected successfully!");
        break;
      } else {
        Serial.println("Reconnection failed, trying next network...");
      }
    }
    
    // If still not connected after trying all networks, restart
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("Failed to reconnect to any network. Restarting device...");
      delay(2000);
      ESP.restart();
    }
  }

  // Update fade effect
  led_update_fade();

  // Block polling during any fade (in or out) to keep animation smooth
  if (!led_is_animating()) {
    poller_tick();
  }
}
