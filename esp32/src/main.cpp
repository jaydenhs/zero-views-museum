#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>

#define RED_PIN   21
#define GREEN_PIN 22
#define BLUE_PIN  23

const char* ssid = "Elora-House";
const char* password = "RogersElora";

WebSocketsServer webSocket = WebSocketsServer(81);  // port 81

void setupPWM() {
  ledcAttachPin(RED_PIN, 0);
  ledcSetup(0, 5000, 8);

  ledcAttachPin(GREEN_PIN, 1);
  ledcSetup(1, 5000, 8);

  ledcAttachPin(BLUE_PIN, 2);
  ledcSetup(2, 5000, 8);
}

void webSocketEvent(uint8_t client, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_TEXT) {
    String msg = String((char *)payload);
    int r = 0, g = 0, b = 0;
    if (msg.equalsIgnoreCase("red")) {
      r = 255; g = 0; b = 0;
    } else if (msg.equalsIgnoreCase("blue")) {
      r = 0; g = 0; b = 255;
    } else if (msg.equalsIgnoreCase("purple")) {
      r = 255; g = 0; b = 255;
    } else {
      sscanf(msg.c_str(), "%d,%d,%d", &r, &g, &b);
    }
    ledcWrite(0, r);
    ledcWrite(1, g);
    ledcWrite(2, b);
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());

  setupPWM();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}
