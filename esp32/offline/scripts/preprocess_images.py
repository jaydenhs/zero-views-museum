#!/usr/bin/env python3
"""
Image preprocessing script for ESP32 offline display.
Downloads images from Supabase, processes them to 30x30 RGB565 format,
and distributes them equally across 4 ESP32 devices.
"""

import os
import sys
import json
import requests
from PIL import Image
import numpy as np
from supabase import create_client, Client
from io import BytesIO
import math
import time
import random
from dotenv import load_dotenv
from tqdm import tqdm

# Retrieve API keys from environment variables
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Configuration
TARGET_SIZE = 30
NUM_ESP32_DEVICES = 4

# Output directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DEVICE_FOLDERS = ["left", "centerLeft", "centerRight", "right"]

def rgb_to_hsl(r, g, b):
    """Convert RGB to HSL (0-1 range)"""
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    diff = max_val - min_val
    
    # Lightness
    l = (max_val + min_val) / 2
    
    if diff == 0:
        h = s = 0  # achromatic
    else:
        # Saturation
        s = diff / (2 - max_val - min_val) if l > 0.5 else diff / (max_val + min_val)
        
        # Hue
        if max_val == r:
            h = (g - b) / diff + (6 if g < b else 0)
        elif max_val == g:
            h = (b - r) / diff + 2
        else:
            h = (r - g) / diff + 4
        h /= 6
    
    return h, s, l

def hsl_to_rgb(h, s, l):
    """Convert HSL to RGB (0-255 range)"""
    def hue_to_rgb(p, q, t):
        if t < 0: t += 1
        if t > 1: t -= 1
        if t < 1/6: return p + (q - p) * 6 * t
        if t < 1/2: return q
        if t < 2/3: return p + (q - p) * (2/3 - t) * 6
        return p
    
    if s == 0:
        r = g = b = l  # achromatic
    else:
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)
    
    return int(r * 255), int(g * 255), int(b * 255)

def rgb_to_rgb565(r, g, b):
    """Convert RGB888 to RGB565"""
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)

def process_image_for_led_strip(image_url, target_width=30, target_height=30, max_retries=3, pbar=None):
    """Process image using the same logic as the frontend imageProcessing.js"""
    for attempt in range(max_retries):
        try:
            # Download image
            response = requests.get(image_url, timeout=30)
            
            # Handle rate limiting (429) with exponential backoff
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)  # Exponential backoff with jitter
                    if pbar:
                        pbar.set_postfix_str(f"Rate limited, waiting {wait_time:.1f}s")
                    time.sleep(wait_time)
                    continue
                else:
                    if pbar:
                        pbar.set_postfix_str("Rate limited, max retries exceeded")
                    return None
            
            response.raise_for_status()
            
            # Open with PIL
            img = Image.open(BytesIO(response.content)).convert('RGB')
            
            # Calculate crop dimensions (same logic as frontend)
            img_aspect = img.width / img.height
            target_aspect = target_width / target_height
            
            if img_aspect > target_aspect:
                source_height = img.height
                source_width = int(img.height * target_aspect)
                source_x = (img.width - source_width) // 2
                source_y = 0
            else:
                source_width = img.width
                source_height = int(img.width / target_aspect)
                source_x = 0
                source_y = (img.height - source_height) // 2
            
            # Crop and resize
            img_cropped = img.crop((source_x, source_y, source_x + source_width, source_y + source_height))
            img_resized = img_cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Convert to numpy array for processing
            pixels = np.array(img_resized)
            
            # Apply saturation boost and serpentine mapping
            SATURATION_BOOST = 1.5
            led_data = []
            
            for y in range(target_height):
                for x in range(target_width):
                    # Serpentine mapping: even rows left-to-right, odd rows right-to-left
                    actual_x = target_width - 1 - x if y % 2 == 1 else x
                    
                    r, g, b = pixels[y, actual_x]
                    
                    # Convert to HSL, apply saturation boost, convert back to RGB
                    h, s, l = rgb_to_hsl(r, g, b)
                    s = min(s * SATURATION_BOOST, 1.0)
                    r, g, b = hsl_to_rgb(h, s, l)
                    
                    # Convert to RGB565
                    rgb565 = rgb_to_rgb565(r, g, b)
                    led_data.append(rgb565)
            
            if pbar:
                pbar.set_postfix_str("✓ Success")
            return led_data
            
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                if pbar:
                    pbar.set_postfix_str(f"Error, retrying in {wait_time:.1f}s")
                time.sleep(wait_time)
                continue
            else:
                if pbar:
                    pbar.set_postfix_str(f"✗ Failed: {str(e)[:30]}...")
                return None
    
    return None

def create_c_header(device_name, images_data):
    """Create C header file with image data in PROGMEM"""
    header_content = f"""#ifndef {device_name.upper()}_IMAGES_H
#define {device_name.upper()}_IMAGES_H

#include <Arduino.h>

// Number of images for {device_name} ESP32
#define NUM_IMAGES_{device_name.upper()} {len(images_data)}

// Image data stored in PROGMEM
const uint16_t {device_name}_images[NUM_IMAGES_{device_name.upper()}][{TARGET_SIZE * TARGET_SIZE}] PROGMEM = {{
"""
    
    for i, image_data in enumerate(images_data):
        header_content += f"  // Image {i}\n"
        header_content += "  {\n"
        
        # Format as 16-bit hex values, 15 per line for readability
        for j in range(0, len(image_data), 15):
            line_data = image_data[j:j+15]
            hex_values = [f"0x{val:04X}" for val in line_data]
            header_content += f"    {', '.join(hex_values)}"
            if j + 15 < len(image_data):
                header_content += ","
            header_content += "\n"
        
        header_content += "  }"
        if i < len(images_data) - 1:
            header_content += ","
        header_content += "\n\n"
    
    header_content += "};\n\n#endif\n"
    
    return header_content

def main():
    print("Starting image preprocessing for ESP32 offline display...")
    
    # Create data directories
    os.makedirs(DATA_DIR, exist_ok=True)
    for folder in DEVICE_FOLDERS:
        os.makedirs(os.path.join(DATA_DIR, folder), exist_ok=True)
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Connected to Supabase")
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        print("Please update SUPABASE_URL and SUPABASE_KEY in the script")
        return
    
    # Fetch images from Supabase with pagination
    print("Fetching images from Supabase...")
    try:
        # First, get the total count
        count_result = supabase.table("artworks_cc").select("*", count="exact").limit(1).execute()
        total_count = count_result.count if hasattr(count_result, 'count') else None
        print(f"Total records in database: {total_count}")
        
        all_images = []
        start_index = 0
        page_size = 1000  # Supabase hard limit
        batch_count = 0
        
        while True:
            batch_count += 1
            end_index = start_index + page_size - 1
            print(f"  Fetching batch {batch_count} (range: {start_index} to {end_index})...")
            
            # Use direct table query with pagination - get ALL images regardless of viewed status
            result = supabase.table("artworks_cc").select("*").range(start_index, end_index).execute()
            
            if result.data is None or len(result.data) == 0:
                print(f"  No more images found in batch {batch_count}")
                break
            
            batch_images = result.data
            all_images.extend(batch_images)
            print(f"  Retrieved {len(batch_images)} images in batch {batch_count}")
            
            # If we got fewer images than the page size, we've reached the end
            if len(batch_images) < page_size - 1:
                print(f"  Reached end of available images")
                break
            
            start_index += page_size
            
            # Safety check to prevent infinite loops
            if batch_count > 50:  # Max 50,000 images
                print(f"  Safety limit reached (50 batches), stopping")
                break
        
        images = all_images
        print(f"Total retrieved: {len(images)} images from {batch_count} batches")
        
        # Limit to 200 images total (50 per ESP32) to fit in flash memory
        if len(images) > 2000:
            images = images[:2000]
            print(f"Limited to first 2000 images so each division fits in ESP32 flash memory")
        
        if len(images) == 0:
            print("No images available")
            return
        
        # Calculate images per device dynamically
        images_per_device = len(images) // NUM_ESP32_DEVICES
        print(f"Distributing {len(images)} images across {NUM_ESP32_DEVICES} ESP32 devices")
        print(f"Each device will get {images_per_device} images")
        
        if len(images) % NUM_ESP32_DEVICES != 0:
            remainder = len(images) % NUM_ESP32_DEVICES
            print(f"Note: {remainder} images will be distributed among the first {remainder} devices")
        
    except Exception as e:
        print(f"Error fetching images: {e}")
        return
    
    # Create overall progress bar for all devices
    device_pbar = tqdm(DEVICE_FOLDERS, desc="Processing ESP32 devices", position=0, leave=True)
    
    for device_idx, device_name in enumerate(device_pbar):
        device_pbar.set_description(f"Processing {device_name} ESP32")
        
        # Calculate start and end indices for this device
        start_idx = device_idx * images_per_device
        # Add one extra image to the first few devices if there's a remainder
        extra_image = 1 if device_idx < (len(images) % NUM_ESP32_DEVICES) else 0
        end_idx = start_idx + images_per_device + extra_image
        
        device_images = images[start_idx:end_idx]
        
        processed_images = []
        successful_count = 0
        failed_images = []
        
        # Create progress bar for this device's images
        image_pbar = tqdm(device_images, desc=f"Processing {device_name} images", 
                         position=1, leave=False, unit="img")
        
        for image_info in image_pbar:
            image_id = image_info.get('id', 'unknown')
            image_pbar.set_postfix_str(f"ID: {image_id}")
            
            # Get high-res image URL
            image_url = image_info.get('url', '')
            # request smaller size
            image_url = image_url.replace("_b.jpg", "_t.jpg")
            if not image_url:
                failed_images.append(image_info)
                image_pbar.set_postfix_str("No URL")
                continue
            
            # Process the image
            led_data = process_image_for_led_strip(image_url, pbar=image_pbar)
            if led_data is not None:
                processed_images.append(led_data)
                successful_count += 1
            else:
                failed_images.append(image_info)
        
        image_pbar.close()
        
        # Retry failed images
        if failed_images:
            retry_pbar = tqdm(range(2), desc=f"Retrying {len(failed_images)} failed images", 
                             position=1, leave=False, unit="attempt")
            
            for retry_attempt in retry_pbar:
                if not failed_images:
                    break
                    
                retry_pbar.set_postfix_str(f"Attempt {retry_attempt + 1}/2")
                still_failed = []
                
                for image_info in failed_images:
                    image_url = image_info.get('url', '')
                    if not image_url:
                        still_failed.append(image_info)
                        continue
                    
                    # Use smaller size for retries to reduce load
                    image_url = image_url.replace("_b.jpg", "_t.jpg")
                    led_data = process_image_for_led_strip(image_url, max_retries=5, pbar=retry_pbar)
                    if led_data is not None:
                        processed_images.append(led_data)
                        successful_count += 1
                    else:
                        still_failed.append(image_info)
                
                failed_images = still_failed
                
                if failed_images and retry_attempt < 1:  # Don't sleep after last attempt
                    retry_pbar.set_postfix_str("Waiting 5s...")
                    time.sleep(5)
            
            retry_pbar.close()
        
        # Update device progress bar
        device_pbar.set_postfix_str(f"✓ {successful_count}/{len(device_images)} images")
        
        if successful_count == 0:
            device_pbar.set_postfix_str("✗ No images processed")
            continue
        
        # Create C header file
        header_content = create_c_header(device_name, processed_images)
        header_path = os.path.join(DATA_DIR, device_name, "images.h")
        
        with open(header_path, 'w') as f:
            f.write(header_content)
        
        # Calculate memory usage
        memory_usage = successful_count * TARGET_SIZE * TARGET_SIZE * 2
        print(f"Memory usage: {memory_usage/1024/1024:.1f}MB")
        device_pbar.set_postfix_str(f"✓ {successful_count} images ({memory_usage/1024/1024:.1f}MB)")
    
    device_pbar.close()
    
    print("\nImage preprocessing complete!")
    print(f"Data saved to: {DATA_DIR}")

if __name__ == "__main__":
    main()
