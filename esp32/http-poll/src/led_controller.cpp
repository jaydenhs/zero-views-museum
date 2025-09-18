#include "led_controller.h"
#include <FastLED.h>

// Internal state
struct FadeState {
  bool active;
  bool isFadeIn;
  int currentStep;
  unsigned long lastStepTime;
};

static CRGB leds[NUM_LEDS];
static CRGB targetLeds[NUM_LEDS];
static CRGB startLeds[NUM_LEDS];
static bool hasImageData = false;
static FadeState fadeState = {false, false, 0, 0};

size_t led_expected_bytes() {
  return (size_t)NUM_LEDS * 3;
}

void led_init() {
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(100);
  FastLED.clear();
  FastLED.show();
}

void led_apply_bytes(const uint8_t *payload, size_t length) {
  Serial.println("Applying bytes to LEDs");
  if (length != led_expected_bytes()) return;
  for (int i = 0; i < NUM_LEDS; i++) {
    int idx = i * 3;
    targetLeds[i] = CRGB(payload[idx], payload[idx + 1], payload[idx + 2]);
    startLeds[i] = leds[i];
  }
  fadeState.active = true;
  fadeState.isFadeIn = true;
  fadeState.currentStep = 0;
  fadeState.lastStepTime = millis();
  hasImageData = true;
}

void led_fade_out_or_clear() {
  Serial.println("Fading out LEDs");
  if (hasImageData) {
    for (int i = 0; i < NUM_LEDS; i++) {
      startLeds[i] = leds[i];
      targetLeds[i] = CRGB(0, 0, 0);
    }
    fadeState.active = true;
    fadeState.isFadeIn = false;
    fadeState.currentStep = 0;
    fadeState.lastStepTime = millis();
  } else {
    FastLED.clear();
    FastLED.show();
  }
  hasImageData = false;
}

void led_update_fade() {
  if (!fadeState.active) return;
  if (millis() - fadeState.lastStepTime < FADE_DELAY) return;
  fadeState.lastStepTime = millis();
  fadeState.currentStep++;

  if (fadeState.currentStep > FADE_STEPS) {
    if (fadeState.isFadeIn) {
      for (int i = 0; i < NUM_LEDS; i++) leds[i] = targetLeds[i];
    } else {
      FastLED.clear();
    }
    FastLED.show();
    fadeState.active = false;
    return;
  }

  float progress = (float)fadeState.currentStep / FADE_STEPS;
  Serial.println("Progress: " + String(progress));
  for (int i = 0; i < NUM_LEDS; i++) {
    if (fadeState.isFadeIn) {
      uint8_t r = startLeds[i].r + (targetLeds[i].r - startLeds[i].r) * progress;
      uint8_t g = startLeds[i].g + (targetLeds[i].g - startLeds[i].g) * progress;
      uint8_t b = startLeds[i].b + (targetLeds[i].b - startLeds[i].b) * progress;
      leds[i] = CRGB(r, g, b);
    } else {
      uint8_t r = startLeds[i].r * (1.0 - progress);
      uint8_t g = startLeds[i].g * (1.0 - progress);
      uint8_t b = startLeds[i].b * (1.0 - progress);
      leds[i] = CRGB(r, g, b);
    }
  }
  FastLED.show();
}

bool led_is_animating() {
  return fadeState.active;
}


