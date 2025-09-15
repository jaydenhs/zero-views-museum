#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <FastLED.h>

// Need to include a wifi-config.h in /include that defines the ssid and password
#include "wifi-config.h"

// Static IP configuration for each board
const uint8_t base_ip[] = {10, 10, 10};
// const uint8_t base_ip[] = {169, 254, 155};
IPAddress local_IP(base_ip[0], base_ip[1], base_ip[2], IP_OCTET);  // IP_OCTET defined by PIO
IPAddress gateway(base_ip[0], base_ip[1], base_ip[2], 1);          // Your router's IP
// IPAddress gateway(0, 0, 0, 0);  // No gateway for link-local network
IPAddress subnet(255, 255, 255, 0);
IPAddress dns(8, 8, 8, 8);

// LED strip configuration for 30x30 grid
#define LED_PIN       21  // Changed from RGB pins to single LED strip pin
#define NUM_LEDS      900 // 30 x 30 = 900 LEDs

// Onboard LED pin for status indication
#define ONBOARD_LED_PIN 2

// Fade effect configuration
#define FADE_STEPS 50  // Number of steps for fade effect
#define FADE_DELAY 10  // Delay between fade steps (20ms * 50 = 1000ms = 1s)

// Non-blocking fade state machine
struct FadeState {
  bool active;
  bool isFadeIn;
  int currentStep;
  unsigned long lastStepTime;
  CRGB startColors[NUM_LEDS];
  CRGB targetColors[NUM_LEDS];
};

FadeState fadeState = {false, false, 0, 0, {}, {}};

WebSocketsServer webSocket = WebSocketsServer(81);
CRGB leds[NUM_LEDS];
CRGB targetLeds[NUM_LEDS];  // Store target colors for fade effect

// Flag to track if we have image data displayed
bool hasImageData = false;

// Function declarations
void processBinaryLEDArray(uint8_t *payload, size_t length);
void fadeInLEDs();
void fadeOutLEDs();
void interruptFade(bool isFadeIn);
void clearLEDStrip();
void updateFade();

// Function to process binary LED array data
void processBinaryLEDArray(uint8_t *payload, size_t length) {
  // Store target colors for fade effect
  for (int i = 0; i < NUM_LEDS; i++) {
    int arrayIndex = i * 3;
    uint8_t r = payload[arrayIndex];
    uint8_t g = payload[arrayIndex + 1];
    uint8_t b = payload[arrayIndex + 2];
    
    targetLeds[i] = CRGB(r, g, b);
  }
  
  // Start fade-in effect (will interrupt any current fade)
  fadeInLEDs();
  
  hasImageData = true;
  Serial.printf("Fading in binary LED array data on LED strip (%d pixels)\n", NUM_LEDS);
}

// Function to fade in LEDs from current state to target colors
void fadeInLEDs() {
  if (fadeState.active) {
    // If there's already a fade active, interrupt it
    interruptFade(true);
    return;
  }
  
  // Initialize fade state
  fadeState.active = true;
  fadeState.isFadeIn = true;
  fadeState.currentStep = 0;
  fadeState.lastStepTime = millis();
  
  // Store current colors as starting point
  for (int i = 0; i < NUM_LEDS; i++) {
    fadeState.startColors[i] = leds[i];
    fadeState.targetColors[i] = targetLeds[i];
  }
  
  Serial.println("Starting non-blocking fade-in effect");
}

// Function to fade out LEDs from current state to off
void fadeOutLEDs() {
  if (fadeState.active) {
    // If there's already a fade active, interrupt it
    interruptFade(false);
    return;
  }
  
  // Initialize fade state
  fadeState.active = true;
  fadeState.isFadeIn = false;
  fadeState.currentStep = 0;
  fadeState.lastStepTime = millis();
  
  // Store current colors as starting point
  for (int i = 0; i < NUM_LEDS; i++) {
    fadeState.startColors[i] = leds[i];
    fadeState.targetColors[i] = CRGB(0, 0, 0); // Target is off
  }
  
  Serial.println("Starting non-blocking fade-out effect");
}

// Function to clear the LED strip
void clearLEDStrip() {
  if (hasImageData) {
    // Use fade-out effect if we have image data
    fadeOutLEDs();
  } else {
    // Immediate clear if no image data
    FastLED.clear();
    FastLED.show();
  }
  hasImageData = false;
  Serial.println("LED strip cleared");
}

// Function to interrupt current fade and start a new one
void interruptFade(bool isFadeIn) {
  if (fadeState.active) {
    Serial.printf("Interrupting current fade, starting new %s\n", 
                 isFadeIn ? "fade-in" : "fade-out");
  }
  
  // Stop current fade
  fadeState.active = false;
  
  // Start new fade immediately
  if (isFadeIn) {
    fadeInLEDs();
  } else {
    fadeOutLEDs();
  }
}

// Non-blocking fade update function
void updateFade() {
  if (!fadeState.active) return;
  
  // Check if it's time for the next step
  if (millis() - fadeState.lastStepTime < FADE_DELAY) return;
  
  fadeState.lastStepTime = millis();
  fadeState.currentStep++;
  
  if (fadeState.currentStep > FADE_STEPS) {
    // Fade complete
    if (fadeState.isFadeIn) {
      // Ensure we end up exactly at target colors
      for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = fadeState.targetColors[i];
      }
      Serial.println("Fade-in effect completed");
    } else {
      // Ensure we end up completely off
      FastLED.clear();
      Serial.println("Fade-out effect completed");
    }
    
    FastLED.show();
    fadeState.active = false;
    return;
  }
  
  // Calculate progress for current step
  float progress = (float)fadeState.currentStep / FADE_STEPS;
  
  // Update LED colors for current step
  for (int i = 0; i < NUM_LEDS; i++) {
    if (fadeState.isFadeIn) {
      // Interpolate between start and target colors
      uint8_t r = fadeState.startColors[i].r + (fadeState.targetColors[i].r - fadeState.startColors[i].r) * progress;
      uint8_t g = fadeState.startColors[i].g + (fadeState.targetColors[i].g - fadeState.startColors[i].g) * progress;
      uint8_t b = fadeState.startColors[i].b + (fadeState.targetColors[i].b - fadeState.startColors[i].b) * progress;
      leds[i] = CRGB(r, g, b);
    } else {
      // Interpolate from start colors to off
      uint8_t r = fadeState.startColors[i].r * (1.0 - progress);
      uint8_t g = fadeState.startColors[i].g * (1.0 - progress);
      uint8_t b = fadeState.startColors[i].b * (1.0 - progress);
      leds[i] = CRGB(r, g, b);
    }
  }
  
  FastLED.show();
}


void webSocketEvent(uint8_t client, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_DISCONNECTED) {
    Serial.printf("Client #%u disconnected\n", client);
    return;
  }
  
  if (type == WStype_CONNECTED) {
    Serial.printf("Client #%u connected from %s\n", client, webSocket.remoteIP(client).toString().c_str());
    return;
  }
  
  // Handle binary messages (LED array data)
  if (type == WStype_BIN) {
    Serial.printf("Received binary message of length: %d bytes\n", length);
    
    // Parse binary message: [length][canvas_id][led_data]
    if (length < 2) {
      Serial.println("Message too short for length-prefixed header");
      return;
    }
    
    uint8_t canvasIdLength = payload[0];
    if (canvasIdLength > 20 || canvasIdLength >= length) {
      Serial.printf("Invalid canvas ID length: %d\n", canvasIdLength);
      return;
    }
    
    // Extract canvas ID
    char canvasId[21]; // Max 20 chars + null terminator
    strncpy(canvasId, (char*)(payload + 1), canvasIdLength);
    canvasId[canvasIdLength] = '\0';
    
    Serial.printf("Canvas ID: %s\n", canvasId);
    
    // Check if this is a clear command (single byte after canvas ID)
    if (length == 1 + canvasIdLength + 1 && payload[1 + canvasIdLength] == 0) {
      Serial.printf("Clear command for canvas: %s\n", canvasId);
      clearLEDStrip();
      return;
    }
    
    // Process LED array data
    int ledDataLength = (int)length - 1 - canvasIdLength;
    if (ledDataLength == NUM_LEDS * 3) {
      Serial.printf("Processing LED array data: %d bytes\n", ledDataLength);
      processBinaryLEDArray(payload + 1 + canvasIdLength, (size_t)ledDataLength);
    } else {
      Serial.printf("Invalid LED data length: %d, expected %d\n", ledDataLength, NUM_LEDS * 3);
    }
    return;
  }
}

void setup() {
  Serial.begin(115200);
  
  // Configure static IP
  if (!WiFi.config(local_IP, gateway, subnet, dns)) {
    Serial.println("Static IP configuration failed");
  }
  
  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // Disable WiFi sleep for faster connection
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());

  // Initialize onboard LED pin
  pinMode(ONBOARD_LED_PIN, OUTPUT);
  digitalWrite(ONBOARD_LED_PIN, LOW); // Start with LED off
  
  // Initialize LED strip
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(100);
  FastLED.clear();
  FastLED.show();
  
  // Give system time to stabilize
  delay(100);

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();

  // Update fade effect
  updateFade();
}
