#include <Arduino.h>
#include <FastLED.h>

// Include the appropriate image header based on build flag
#ifdef IMAGE_FOLDER_LEFT
  #include "../data/left/images.h"
  #define CURRENT_IMAGES left_images
  #define NUM_CURRENT_IMAGES NUM_IMAGES_LEFT
#elif defined(IMAGE_FOLDER_CENTERLEFT)
  #include "../data/centerLeft/images.h"
  #define CURRENT_IMAGES centerLeft_images
  #define NUM_CURRENT_IMAGES NUM_IMAGES_CENTERLEFT
#elif defined(IMAGE_FOLDER_CENTERRIGHT)
  #include "../data/centerRight/images.h"
  #define CURRENT_IMAGES centerRight_images
  #define NUM_CURRENT_IMAGES NUM_IMAGES_CENTERRIGHT
#elif defined(IMAGE_FOLDER_RIGHT)
  #include "../data/right/images.h"
  #define CURRENT_IMAGES right_images
  #define NUM_CURRENT_IMAGES NUM_IMAGES_RIGHT
#else
  #error "No IMAGE_FOLDER defined. Please set one of: IMAGE_FOLDER_LEFT, IMAGE_FOLDER_CENTERLEFT, IMAGE_FOLDER_CENTERRIGHT, IMAGE_FOLDER_RIGHT"
#endif

#define LED_PIN 21
#define NUM_LEDS 900
#define MATRIX_WIDTH 30
#define MATRIX_HEIGHT 30

// Display configuration
#define MAX_BRIGHTNESS 100
#define FADE_IN_DURATION_MIN 2000     
#define FADE_IN_DURATION_MAX 4000    
#define FADE_OUT_DURATION_MIN 2000   
#define FADE_OUT_DURATION_MAX 4000  
#define HOLD_DURATION_MIN 3000      
#define HOLD_DURATION_MAX 5000      
#define WAIT_DURATION_MIN 3000      
#define WAIT_DURATION_MAX 5000      

CRGB leds[NUM_LEDS];

// Display state variables
enum DisplayState {
  FADE_IN,
  HOLD,
  FADE_OUT,
  WAIT
};

DisplayState currentState = FADE_IN;
unsigned long stateStartTime = 0;
int currentImageIndex = 0;
uint8_t currentBrightness = 0;

// Current duration variables (randomly generated)
unsigned long currentFadeInDuration = 0;
unsigned long currentFadeOutDuration = 0;
unsigned long currentHoldDuration = 0;
unsigned long currentWaitDuration = 0;

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

// Convert RGB565 to RGB888
CRGB rgb565_to_rgb(uint16_t rgb565) {
  uint8_t r = ((rgb565 & 0xF800) >> 11) << 3;
  uint8_t g = ((rgb565 & 0x07E0) >> 5) << 2;
  uint8_t b = (rgb565 & 0x001F) << 3;
  
  // Scale up to 8-bit range
  r |= r >> 5;
  g |= g >> 6;
  b |= b >> 5;
  
  return CRGB(r, g, b);
}

// Generate random duration between min and max
unsigned long randomDuration(unsigned long minDuration, unsigned long maxDuration) {
  return random(minDuration, maxDuration + 1);
}

// Generate new random durations for the current image
void generateNewDurations() {
  currentFadeInDuration = randomDuration(FADE_IN_DURATION_MIN, FADE_IN_DURATION_MAX);
  currentFadeOutDuration = randomDuration(FADE_OUT_DURATION_MIN, FADE_OUT_DURATION_MAX);
  currentHoldDuration = randomDuration(HOLD_DURATION_MIN, HOLD_DURATION_MAX);
  currentWaitDuration = randomDuration(WAIT_DURATION_MIN, WAIT_DURATION_MAX);
  
  Serial.print("New durations - FadeIn: ");
  Serial.print(currentFadeInDuration);
  Serial.print("ms, Hold: ");
  Serial.print(currentHoldDuration);
  Serial.print("ms, FadeOut: ");
  Serial.print(currentFadeOutDuration);
  Serial.print("ms, Wait: ");
  Serial.print(currentWaitDuration);
  Serial.println("ms");
}

// Display current image with brightness control
void displayCurrentImage() {
  // Validate image index
  if (currentImageIndex >= NUM_CURRENT_IMAGES) {
    currentImageIndex = 0; // Reset to first image if invalid
  }
  
  // Get image data from PROGMEM
  uint16_t imageData[MATRIX_WIDTH * MATRIX_HEIGHT];
  memcpy_P(imageData, CURRENT_IMAGES[currentImageIndex], sizeof(imageData));
  
  // Display image on LED matrix
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < MATRIX_WIDTH; x++) {
      uint16_t ledIndex = XY(x, y);
      if (ledIndex < NUM_LEDS && ledIndex != 0xFFFF) { // Check for valid LED index
        uint16_t pixelIndex = y * MATRIX_WIDTH + x;
        if (pixelIndex < (MATRIX_WIDTH * MATRIX_HEIGHT)) { // Additional bounds check
          CRGB color = rgb565_to_rgb(imageData[pixelIndex]);
          
          // Apply brightness scaling
          color.nscale8(currentBrightness);
          leds[ledIndex] = color;
        }
      }
    }
  }
}

// Update display state machine
void updateDisplayState() {
  unsigned long currentTime = millis();
  unsigned long elapsed = currentTime - stateStartTime;
  
  switch (currentState) {
    case FADE_IN:
      if (elapsed >= currentFadeInDuration) {
        currentBrightness = MAX_BRIGHTNESS;
        currentState = HOLD;
        stateStartTime = currentTime;
        Serial.println("Fade in complete, holding image");
      } else {
        // Linear fade in
        currentBrightness = map(elapsed, 0, currentFadeInDuration, 0, MAX_BRIGHTNESS);
      }
      break;
      
    case HOLD:
      if (elapsed >= currentHoldDuration) {
        currentState = FADE_OUT;
        stateStartTime = currentTime;
        Serial.println("Hold complete, fading out");
      }
      break;
      
    case FADE_OUT:
      if (elapsed >= currentFadeOutDuration) {
        currentBrightness = 0;
        // Clear all LEDs when fade out is complete
        FastLED.clear();
        currentState = WAIT;
        stateStartTime = currentTime;
        Serial.println("Fade out complete, waiting");
      } else {
        // Linear fade out
        currentBrightness = map(elapsed, 0, currentFadeOutDuration, MAX_BRIGHTNESS, 0);
      }
      break;
      
    case WAIT:
      if (elapsed >= currentWaitDuration) {
        // Clear LEDs before switching to new image
        FastLED.clear();
        
        // Select a random image
        currentImageIndex = random(0, NUM_CURRENT_IMAGES);
        
        // Generate new random durations for the next image
        generateNewDurations();
        
        // Reset brightness to 0 for clean fade in
        currentBrightness = 0;
        currentState = FADE_IN;
        stateStartTime = currentTime;
        Serial.print("Starting random image ");
        Serial.print(currentImageIndex);
        Serial.print(" of ");
        Serial.println(NUM_CURRENT_IMAGES);
      }
      break;
  }
}


void setup() {
  Serial.begin(115200);
  Serial.println("Starting ESP32 Offline Image Display");
  
  // Initialize FastLED
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(MAX_BRIGHTNESS);
  FastLED.clear();
  FastLED.show();
  
  Serial.println("LED strip initialized");
  Serial.print("Matrix size: ");
  Serial.print(MATRIX_WIDTH);
  Serial.print("x");
  Serial.println(MATRIX_HEIGHT);
  Serial.print("Total LEDs: ");
  Serial.println(NUM_LEDS);
  Serial.print("Images loaded: ");
  Serial.println(NUM_CURRENT_IMAGES);
  
  // Initialize random seed
  randomSeed(analogRead(0));
  
  // Initialize display state
  currentState = FADE_IN;
  stateStartTime = millis();
  currentImageIndex = 0;
  currentBrightness = 0;
  
  // Generate initial random durations
  generateNewDurations();
  
  Serial.println("Starting image display sequence...");
}

void loop() {
  // Update display state machine
  updateDisplayState();
  
  // Only display image if not in WAIT state (LEDs should be off during wait)
  if (currentState != WAIT) {
    displayCurrentImage();
  }
  
  // Update LEDs
  FastLED.show();
  
  // Small delay to prevent overwhelming the system
  delay(20);
}
