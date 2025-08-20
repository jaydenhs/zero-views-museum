#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>

// Need to include a wifi-config.h in /include that defines the ssid and password
#include "wifi-config.h"

#define RED_PIN   21
#define GREEN_PIN 22
#define BLUE_PIN  23
#define ONBOARD_LED_PIN 2

WebSocketsServer webSocket = WebSocketsServer(81);

void setupPWM() {
  ledcAttachPin(RED_PIN, 0);
  ledcSetup(0, 5000, 8);

  ledcAttachPin(GREEN_PIN, 1);
  ledcSetup(1, 5000, 8);

  ledcAttachPin(BLUE_PIN, 2);
  ledcSetup(2, 5000, 8);
}

static inline void pulseOnboard() {
  digitalWrite(ONBOARD_LED_PIN, HIGH);
  delay(200);
  digitalWrite(ONBOARD_LED_PIN, LOW);
}

void webSocketEvent(uint8_t client, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    String msg = String((char *)payload, length);

	// JSON payloads
    if (length > 0 && payload[0] == '{') {
      // Look for {"action":"pulse"} pattern
      if (msg.indexOf("\"action\"") != -1 && msg.indexOf("\"pulse\"") != -1) {
        pulseOnboard(); 
        Serial.println("Pulse command received!");
        return; 
      }
      Serial.println("JSON received but no valid action: " + msg);
      return;
    }

    int r = 0, g = 0, b = 0;
    if (sscanf(msg.c_str(), "%d,%d,%d", &r, &g, &b) == 3) {
      r = constrain(r, 0, 255);
      g = constrain(g, 0, 255);
      b = constrain(b, 0, 255);
      ledcWrite(0, r);
      ledcWrite(1, g);
      ledcWrite(2, b);
    }
  }
}

void setup() {
  Serial.begin(115200);
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

  setupPWM();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}
