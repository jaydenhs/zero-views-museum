#!/usr/bin/env python3
"""
Download images from Supabase database and store them locally.
This script fetches image metadata from Supabase and downloads the actual images.
"""

import os
import sqlite3
import asyncio
import aiohttp
import aiofiles
from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv
from supabase import create_client
from tqdm import tqdm
import hashlib
from PIL import Image
import io

# Load environment variables
load_dotenv()

# Supabase connection
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Local database path
DB_PATH = "artworks.db"
IMAGES_DIR = "images"

def ensure_directories():
    """Create necessary directories."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

def get_image_extension(url):
    """Extract file extension from URL."""
    parsed = urlparse(url)
    path = parsed.path
    if '.' in path:
        return path.split('.')[-1].lower()
    return 'jpg'  # Default to jpg for Flickr images

def generate_local_filename(url, artwork_id):
    """Generate a unique local filename for the image."""
    # Use artwork ID as base, add extension
    ext = get_image_extension(url)
    return f"{artwork_id}.{ext}"

async def download_image(session, url, local_path, max_retries=3):
    """Download a single image asynchronously with retry logic for rate limiting."""
    for attempt in range(max_retries):
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    content = await response.read()
                    
                    # Verify it's actually an image
                    try:
                        img = Image.open(io.BytesIO(content))
                        img.verify()  # Verify it's a valid image
                        
                        # Save the image
                        async with aiofiles.open(local_path, 'wb') as f:
                            await f.write(content)
                        
                        return True, img.size  # Return success and dimensions
                    except Exception as e:
                        print(f"Invalid image data for {url}: {e}")
                        return False, None
                elif response.status == 429:
                    # Rate limited - wait longer before retry
                    wait_time = (2 ** attempt) * 5  # Exponential backoff: 5s, 10s, 20s
                    print(f"Rate limited (429) for {url}. Waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    print(f"Failed to download {url}: HTTP {response.status}")
                    return False, None
        except Exception as e:
            print(f"Error downloading {url} (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Brief delay before retry
            else:
                return False, None
    
    print(f"Failed to download {url} after {max_retries} attempts")
    return False, None

async def fetch_artworks_from_supabase(limit=None):
    """Fetch artwork metadata from Supabase with pagination support."""
    try:
        all_artworks = []
        page_size = 1000  # Supabase default page size
        offset = 0
        
        while True:
            # Fetch artworks in batches
            response = supabase.table("artworks_cc").select("*").range(offset, offset + page_size).execute()
            
            if not response.data:
                break
                
            all_artworks.extend(response.data)
            
            # If we got less than page_size, we've reached the end
            if len(response.data) < page_size:
                break
                
            offset += page_size
            
            # If we have a limit and we've reached it, break
            if limit and len(all_artworks) >= limit:
                break
        
        if limit:
            return all_artworks[:limit]
        return all_artworks
        
    except Exception as e:
        print(f"Error fetching from Supabase: {e}")
        return []

def save_artwork_to_local_db(artwork, local_path, width=None, height=None):
    """Save artwork metadata to local SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO artworks_cc 
            (id, media_type, source, creator_name, url, title, description, 
             query, view_url, created_at, entry_created_at, viewed, local_path, width, height)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            artwork['id'],
            artwork['media_type'],
            artwork['source'],
            artwork['creator_name'],
            artwork['url'],
            artwork['title'],
            artwork['description'],
            artwork['query'],
            artwork['view_url'],
            artwork['created_at'],
            artwork['entry_created_at'],
            artwork.get('viewed', False),
            local_path,
            width,
            height
        ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Error saving to local DB: {e}")
        return False
    finally:
        conn.close()

async def download_all_images(limit=None, batch_size=3):
    """Download all images from Supabase to local storage."""
    ensure_directories()
    
    print("Fetching artwork metadata from Supabase...")
    artworks = await fetch_artworks_from_supabase(limit)
    
    if not artworks:
        print("No artworks found in Supabase database.")
        return
    
    print(f"Found {len(artworks)} artworks. Starting download...")
    
    # Create semaphore to limit concurrent downloads
    semaphore = asyncio.Semaphore(batch_size)
    
    async def download_with_semaphore(session, artwork):
        async with semaphore:
            url = artwork['url']
            local_filename = generate_local_filename(url, artwork['id'])
            local_path = os.path.join(IMAGES_DIR, local_filename)
            
            # Check if file already exists
            if os.path.exists(local_path):
                print(f"Image already exists: {local_filename}")
                # Still update the database with local path
                save_artwork_to_local_db(artwork, local_path)
                return True
            
            # Add a small delay between requests to be respectful to Flickr
            await asyncio.sleep(0.5)  # 500ms delay between requests
            
            success, dimensions = await download_image(session, url, local_path)
            
            if success:
                width, height = dimensions if dimensions else (None, None)
                save_artwork_to_local_db(artwork, local_path, width, height)
                return True
            else:
                print(f"Failed to download: {url}")
                return False
    
    # Download images in batches
    async with aiohttp.ClientSession() as session:
        tasks = [download_with_semaphore(session, artwork) for artwork in artworks]
        
        # Use tqdm for progress tracking
        results = []
        for task in tqdm(asyncio.as_completed(tasks), total=len(tasks), desc="Downloading images"):
            result = await task
            results.append(result)
    
    successful_downloads = sum(results)
    print(f"Download completed: {successful_downloads}/{len(artworks)} images downloaded successfully")

def get_local_image_count():
    """Get count of images in local database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM artworks_cc WHERE local_path IS NOT NULL")
    count = cursor.fetchone()[0]
    
    conn.close()
    return count

def get_unviewed_images(limit=4):
    """Get unviewed images from local database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM artworks_cc 
        WHERE viewed = FALSE AND local_path IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
    ''', (limit,))
    
    results = cursor.fetchall()
    columns = [description[0] for description in cursor.description]
    
    conn.close()
    
    # Convert to list of dictionaries
    return [dict(zip(columns, row)) for row in results]

def mark_images_as_viewed(image_ids):
    """Mark images as viewed in local database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    placeholders = ','.join(['?' for _ in image_ids])
    cursor.execute(f'''
        UPDATE artworks_cc 
        SET viewed = TRUE 
        WHERE id IN ({placeholders})
    ''', image_ids)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Download images from Supabase to local storage")
    parser.add_argument("--limit", type=int, help="Limit number of images to download")
    parser.add_argument("--batch-size", type=int, default=1, help="Number of concurrent downloads")
    
    args = parser.parse_args()
    
    asyncio.run(download_all_images(limit=args.limit, batch_size=args.batch_size))
