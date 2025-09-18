# ESP32 Offline Image Display

This ESP32 project displays pre-processed images on a 30x30 LED matrix in offline mode. Images are loaded from PROGMEM and displayed with fade effects.

## Setup Instructions

### 1. Pre-process Images

First, update the Supabase credentials in `scripts/preprocess_images.py`:

```python
SUPABASE_URL = "https://your-project.supabase.co"  # Your actual URL
SUPABASE_KEY = "your-anon-key"  # Your actual key
```

Then run the preprocessing script:

```bash
cd esp32/offline/scripts
pip install -r requirements.txt
python preprocess_images.py
```

This will:

- Download all available images from Supabase (up to 10,000)
- Process them to 30x30 RGB565 format
- Split them equally across 4 folders: `left/`, `centerLeft/`, `centerRight/`, `right/`
- Generate C header files for each ESP32 device
- Handle remainder images by distributing them to the first few devices

### 2. Configure ESP32

For each ESP32 device, update the `platformio.ini` file to specify which image folder to use:

```ini
build_flags =
    -DIMAGE_FOLDER=left  # Change to: centerLeft, centerRight, or right
```

### 3. Build and Upload

```bash
pio run -t upload
```

## Display Behavior

- **Linear progression**: Images are displayed in order (0, 1, 2, ...)
- **Fade effects**: 1-second fade in, 4-second hold, 1-second fade out
- **Wait time**: 1-10 seconds between images
- **Loop**: After the last image, it starts over from the first

## Memory Usage

- **Per image**: 1,800 bytes (30×30×2 bytes for RGB565)
- **Images per device**: Dynamically calculated based on total available images
- **Total capacity**: ~2,300 images maximum in 4MB Flash per ESP32

## File Structure

```
esp32/offline/
├── data/                    # Generated image data
│   ├── left/images.h
│   ├── centerLeft/images.h
│   ├── centerRight/images.h
│   └── right/images.h
├── scripts/
│   ├── preprocess_images.py
│   └── requirements.txt
├── src/
│   └── main.cpp
├── platformio.ini
└── README.md
```

## Configuration

You can adjust display timing in `src/main.cpp`:

```cpp
#define FADE_IN_DURATION 1000    // 1 second fade in
#define FADE_OUT_DURATION 1000   // 1 second fade out
#define HOLD_DURATION 4000       // 4 seconds hold
#define WAIT_DURATION_MIN 1000   // 1 second minimum wait
#define WAIT_DURATION_MAX 10000  // 10 seconds maximum wait
```
