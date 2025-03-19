import os
import aiohttp
import asyncio
from dotenv import load_dotenv
from supabase import create_client
import uuid
import datetime
import time

# Load environment variables
load_dotenv()

# API Keys & Supabase
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Connect to Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SEARCH_QUERIES = ["short film", "indie short", "experimental short"]

async def search_youtube_videos(query, max_results=50):
    """Search YouTube for short films."""
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "id,snippet",
        "q": query,
        "type": "video",
        "videoDuration": "short",
        "maxResults": max_results,
        "key": YOUTUBE_API_KEY
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()
            return [video["id"]["videoId"] for video in data.get("items", [])]

async def get_video_details(video_ids):
    """Fetch view count and other details for videos."""
    if not video_ids:
        return []

    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics",
        "id": ",".join(video_ids),
        "key": YOUTUBE_API_KEY
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()
            return [
                {
                    "id": vid["id"],
                    "title": vid["snippet"]["title"],
                    "description": vid["snippet"]["description"],
                    "creator_name": vid["snippet"]["channelTitle"],
                    "view_count": int(vid["statistics"].get("viewCount", 1)),  # Default to 1 if missing
                    "published_at": vid["snippet"]["publishedAt"],
                }
                for vid in data.get("items", [])
            ]

async def save_to_supabase(videos, query):
    """Store filtered videos (zero views) in Supabase."""
    zero_view_videos = [vid for vid in videos if vid["view_count"] == 0]
    if not zero_view_videos:
        print("No videos with zero views.")
        return

    for vid in zero_view_videos:
        video_entry = {
            "id": str(uuid.uuid4()),
            "media_type": "video",
            "source": "YouTube",
            "creator_name": vid["creator_name"],
            "url": f"https://www.youtube.com/watch?v={vid['id']}",
            "title": vid["title"],
            "description": vid["description"],
            "query": query,
            "view_url": f"https://www.youtube.com/watch?v={vid['id']}",
            "created_at": vid["published_at"],
            "entry_created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        # supabase.table("artworks").insert(video_entry).execute()
        print(f"Inserted: {video_entry['url']} | Query: {query}")

async def run_scraping():
    """Run YouTube scraping process."""
    for query in SEARCH_QUERIES:
        try:
            video_ids = await search_youtube_videos(query)
            videos = await get_video_details(video_ids)
            await save_to_supabase(videos, query)
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_scraping())
