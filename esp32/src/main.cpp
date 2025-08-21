#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

// Need to include a wifi-config.h in /include that defines the ssid and password
#include "wifi-config.h"

// Static IP configuration for each board
IPAddress local_IP(192, 168, 2, IP_OCTET);  // IP_OCTET defined by PIO
IPAddress gateway(192, 168, 2, 1);     // Your router's IP
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

#define RED_PIN   21
#define GREEN_PIN 22
#define BLUE_PIN  23
#define ONBOARD_LED_PIN 2

WebSocketsServer webSocket = WebSocketsServer(81);

void webSocketEvent(uint8_t client, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    String msg = String((char *)payload, length);

    // JSON payloads
    if (length > 0 && payload[0] == '{') {
      Serial.printf("Time: %lu ms\n", millis());
      // Serial.printf("Received JSON: %s\n", msg.c_str());  // Debug: see what we're getting
      
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, msg);
      
      if (error) {
        Serial.println("JSON parsing failed");
        return;
      }
      
      // // Debug: print all keys in the document
      // Serial.println("JSON keys found:");
      // for (JsonPair kv : doc.as<JsonObject>()) {
      //   Serial.printf("  %s: %s\n", kv.key().c_str(), kv.value().as<const char*>());
      // }
      
      // Check if the fields exist and are not null before using them
      if (doc.containsKey("action") && doc.containsKey("canvas")) {
        const char* action = doc["action"];
        const char* canvas = doc["canvas"];
        
        if (action && canvas) {  // Additional null check
          if (strcmp(action, "looked_at") == 0) {
            digitalWrite(ONBOARD_LED_PIN, HIGH);
            Serial.printf("Looked at %s - LED ON\n", canvas);
          } else if (strcmp(action, "not_looked_at") == 0) {
            digitalWrite(ONBOARD_LED_PIN, LOW);
            Serial.printf("Not looked at %s - LED OFF\n", canvas);
          } else {
            Serial.printf("Unknown action: %s\n", action);
          }
        }
      } else {
        Serial.println("Missing required fields in JSON");
      }
      return;
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // Configure static IP
  if (!WiFi.config(local_IP, gateway, subnet, dns)) {
    Serial.println("Static IP configuration failed");
  }
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());

  pinMode(ONBOARD_LED_PIN, OUTPUT);
  digitalWrite(ONBOARD_LED_PIN, LOW);

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}
