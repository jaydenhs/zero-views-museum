// LED controller: FastLED setup, fade state machine, and helpers

#pragma once
#include <Arduino.h>

// Hardware configuration
#define LED_PIN 21
#define NUM_LEDS 900

// Fade configuration
#define FADE_STEPS 50
#define FADE_DELAY 10

// Initialize FastLED and strip state
void led_init();

// Apply a new LED frame (RGB triplets, length must be led_expected_bytes())
void led_apply_bytes(const uint8_t *payload, size_t length);

// Start fade-out to off (if content was shown)
void led_fade_out_or_clear();

// Advance fade animation (call every loop)
void led_update_fade();

// Expected byte length for a full frame
size_t led_expected_bytes();

// True while any fade animation (in or out) is running
bool led_is_animating();

