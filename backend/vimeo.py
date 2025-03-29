import os
import aiohttp
import asyncio
import uuid
import datetime
import time
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# API Keys & Supabase
VIMEO_ACCESS_TOKEN = os.getenv("VIMEO_ACCESS_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Connect to Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# SEARCH_QUERIES = ["student film", "old home video", "animation", "short film"]
SEARCH_QUERIES = ["student film"]

async def search_vimeo_videos(query, page, max_results=100):
    """Search Vimeo for videos with the given query and return detailed info directly."""
    url = "https://api.vimeo.com/videos"
    headers = {"Authorization": f"Bearer {VIMEO_ACCESS_TOKEN}"}
    params = {
        "page": page,
        "query": query,
        "per_page": max_results,
        "sort": "relevant",
        "direction": "asc",
        "duration": "short"
    }

    videos = []
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers, params=params) as response:
            if response.status != 200:
                print(f"Error: {response.status} - {await response.text()}")
                return []

            data = await response.json()
            if "error" in data:
                print(f"API Error: {data['error']}")
                return []

            if not data.get("data"):
                print(f"No more results for '{query}'")
                return []

            for video in data["data"]:
                view_count = video.get("stats", {}).get("plays", 0) 
                duration_seconds = video.get("duration", 0)

                if view_count == 0 and duration_seconds > 30:  # Only keep videos with zero views and longer than 30s
                    print(f"Found video: vimeo.com/{video['uri'].split('/')[-1]} | {video['name']} | {view_count} views")
                    videos.append({
                        "id": video["uri"].split("/")[-1],
                        "title": video["name"],
                        "description": video.get("description", ""),
                        "creator_name": video["user"]["name"],
                        "published_at": video["created_time"],
                        "duration": duration_seconds,  
                    })

            # Check for rate limit and sleep if necessary
            remaining_requests = int(response.headers.get("X-RateLimit-Remaining", 0))
            print(f"Remaining requests: {remaining_requests}")
            if remaining_requests == 0:
                reset_time = int(response.headers.get("X-RateLimit-Reset", time.time()))
                sleep_time = reset_time - int(time.time()) + 1  # Sleep until reset
                print(f"Rate limit reached, sleeping for {sleep_time} seconds.")
                await asyncio.sleep(sleep_time)

    return videos

async def save_to_supabase(videos, query):
    for vid in videos:
        video_entry = {
            "id": str(uuid.uuid4()),
            "media_type": "video",
            "source": "Vimeo",
            "creator_name": vid["creator_name"],
            "url": f"https://vimeo.com/{vid['id']}",
            "title": vid["title"],
            "description": vid["description"],
            "query": query,
            "view_url": f"https://vimeo.com/{vid['id']}",
            "created_at": vid["published_at"],
            "entry_created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "duration": vid["duration"],  # Save duration directly here
        }

        # supabase.table("artworks").insert(video_entry).execute()
        # print(f"Inserted: {video_entry['url']} | Query: {query}")

async def run_scraping():
    for query in SEARCH_QUERIES:
        page = 1  
        while page <= 25:
            try:
                videos = await search_vimeo_videos(query, page)  
                if videos:
                    await save_to_supabase(videos, query) 
                page += 1  
            except Exception as e:
                print(f"Error: {e}")
                break  


if __name__ == "__main__":
    asyncio.run(run_scraping())
