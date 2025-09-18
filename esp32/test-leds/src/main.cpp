#include <Arduino.h>
#include <FastLED.h>

#define LED_PIN 21
#define NUM_LEDS 900
#define MATRIX_WIDTH 30
#define MATRIX_HEIGHT 30

// Gradient configuration
#define BRIGHTNESS 100
#define GRADIENT_CYCLES 5  // Number of color cycles across the matrix

CRGB leds[NUM_LEDS];

// FastLED XY function for serpentine matrix mapping
// This is the standard way FastLED expects matrix coordinates to be mapped
uint16_t XY(uint8_t x, uint8_t y) {
  if (x >= MATRIX_WIDTH || y >= MATRIX_HEIGHT) {
    return -1; // Invalid coordinates
  }
  
  // Serpentine layout: even rows go left-to-right, odd rows go right-to-left
  if (y % 2 == 0) {
    // Even rows: left to right
    return (y * MATRIX_WIDTH) + x;
  } else {
    // Odd rows: right to left
    return (y * MATRIX_WIDTH) + (MATRIX_WIDTH - 1 - x);
  }
}

// Create an animated radial gradient from center
void createAnimatedRadialGradient() {
  int centerX = MATRIX_WIDTH / 2;
  int centerY = MATRIX_HEIGHT / 2;
  int maxDistance = max(centerX, centerY);
  
  // Get current time for animation
  unsigned long currentTime = millis();
  float timeScale = 0.0005; // Adjust this to control animation speed
  
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < MATRIX_WIDTH; x++) {
      uint16_t ledIndex = XY(x, y);
      if (ledIndex < NUM_LEDS) {
        // Calculate distance from center
        int dx = x - centerX;
        int dy = y - centerY;
        float distance = sqrt(dx * dx + dy * dy);
        
        // Calculate angle for rotation
        float angle = atan2(dy, dx);
        
        // Create animated radial gradient with rotating hue
        float normalizedDistance = distance / maxDistance;
        float timeOffset = currentTime * timeScale;
        float hueFloat = normalizedDistance * 255 * GRADIENT_CYCLES + angle * 40.74 + timeOffset * 50;
        uint8_t hue = (uint8_t)((int)hueFloat % 255);
        
        leds[ledIndex] = CHSV(hue, 255, 255);
      }
    }
  }
}


void setup() {
  Serial.begin(115200);
  Serial.println("Starting LED Gradient Display");
  
  // Initialize FastLED
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
  
  Serial.println("LED strip initialized");
  Serial.print("Matrix size: ");
  Serial.print(MATRIX_WIDTH);
  Serial.print("x");
  Serial.println(MATRIX_HEIGHT);
  Serial.print("Total LEDs: ");
  Serial.println(NUM_LEDS);
  
  // Initialize with animated radial gradient
  createAnimatedRadialGradient();
  FastLED.show();
  Serial.println("Animated radial gradient started!");
}

void loop() {
  // Continuously update the animated radial gradient
  createAnimatedRadialGradient();
  FastLED.show();
}
