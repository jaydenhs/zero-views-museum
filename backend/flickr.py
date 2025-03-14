import os
import aiohttp
import asyncio
from dotenv import load_dotenv
from supabase import create_client
import uuid
import datetime
import time

# Load environment variables from .env file
load_dotenv()

# Retrieve API keys from environment variables
FLICKR_API_KEY = os.getenv("FLICKR_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Connect to Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# List of art-related prompts
SEARCH_QUERIES = [
    "photography"
]

async def search_flickr_images(query, min_upload_date, max_upload_date, per_page=500):
    url = "https://api.flickr.com/services/rest/"
    params = {
        "method": "flickr.photos.search",
        "api_key": FLICKR_API_KEY,
        "text": query,
        "media": "photos",
        "per_page": per_page,
        "format": "json",
        "nojsoncallback": 1,
        "extras": "views,description,owner_name,date_taken",
        "min_upload_date": min_upload_date,
        "max_upload_date": max_upload_date,
        "safe_search": 1
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            response_data = await response.json()
            images = response_data.get("photos", {}).get("photo", [])
            zero_view_images = [img for img in images if int(img.get("views", 1)) == 0]

            return zero_view_images
        
async def get_flickr_realname(user_id):
    """Fetch the real name of a Flickr user by their NSID."""
    url = "https://api.flickr.com/services/rest/"
    params = {
        "method": "flickr.people.getInfo",
        "api_key": FLICKR_API_KEY,
        "user_id": user_id,
        "format": "json",
        "nojsoncallback": 1
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            response_data = await response.json()
            person = response_data.get("person", {})
            realname = person.get("realname", {}).get("_content", None)
            if realname != "":
                return realname
            else:
                return None

async def save_to_supabase(image_data, query):
    if not image_data:
        print("No images with zero views.")
        return

    for img in image_data:
        user_id = img.get("owner", "Unknown")
        realname = await get_flickr_realname(user_id)  # Fetch real name if available

        flickr_page_url = f"https://www.flickr.com/photos/{img['owner']}/{img['id']}"

        img_entry = {
            "id": str(uuid.uuid4()),  # Generate a UUID
            "media_type": "image",
            "source": "Flickr",
            "creator_name": realname or img.get("ownername", "Unknown"),
            "url": f"https://live.staticflickr.com/{img['server']}/{img['id']}_{img['secret']}_b.jpg",
            "title": img.get("title", "Untitled"),
            "description": img.get("description", {}).get("_content", "No description"),
            "query": query,  # Store the search term
            "view_url": flickr_page_url,  # Store the original link
            "created_at": img.get("datetaken", "Unknown"),
            "entry_created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # Insert into Supabase
        supabase.table("artworks").insert(img_entry).execute()
        print(f"Inserted: {img_entry["url"]} | Query: {query}")

async def run_scraping():
    """Runs the scraping process with a delay between requests. Waits for an hour if rate-limited."""
    start_date = datetime.datetime(2011, 1, 1)
    end_date = datetime.datetime.now()
    delta = datetime.timedelta(weeks=4)

    date_ranges = []
    current_date = start_date
    while current_date < end_date:
        next_date = current_date + delta
        date_ranges.append((current_date.strftime("%Y-%m-%d"), next_date.strftime("%Y-%m-%d")))
        current_date = next_date

    for query in SEARCH_QUERIES:
        for min_date, max_date in date_ranges:
            try:
                images = await search_flickr_images(query, min_date, max_date)

                # Check for Flickr API error response
                if isinstance(images, dict) and "stat" in images and images["stat"] == "fail":
                    error_code = images.get("code", None)
                    error_msg = images.get("message", "Unknown error")

                    if error_code == 429:  # Rate limit exceeded
                        print(f"Rate limit exceeded. Waiting for 1 hour before continuing...")
                        time.sleep(3600)  # Wait for 1 hour before moving to the next query
                        break  # Move to the next date range after waiting

                    print(f"Error {error_code}: {error_msg}. Skipping this request.")
                    break  # Skip to the next date range

                await save_to_supabase(images, query)

            except Exception as e:
                print(f"An error occurred: {e}. Skipping to the next date range.")
                break  # Skip to the next date range

if __name__ == "__main__":
    asyncio.run(run_scraping())  # Run as fast as possible, pause if needed