import os
import aiohttp
import asyncio
import random
from dotenv import load_dotenv
from supabase import create_client
import uuid
import datetime
import isodate

# Load environment variables
load_dotenv()

# API Keys & Supabase
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Connect to Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SEARCH_QUERIES = ["student film", "old home video", "animation", "short film"]

# Generate random date ranges (one-week window) from 2005 to a month before today
def get_random_date_range():
    start_date = datetime.datetime(2005, 1, 1)
    end_date = datetime.datetime.now() - datetime.timedelta(days=360)  # Avoid very recent videos
    random_start = start_date + datetime.timedelta(days=random.randint(0, (end_date - start_date).days - 7))
    random_end = random_start + datetime.timedelta(days=360)
    return random_start.isoformat("T") + "Z", random_end.isoformat("T") + "Z"

async def search_youtube_videos(query, published_after, published_before, max_results=50):
    """Search YouTube for videos with the given date range."""
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "id,snippet",
        "q": query,
        "type": "video",
        "videoDuration": "any",
        "maxResults": max_results,
        "publishedAfter": published_after,
        "publishedBefore": published_before,
        "key": YOUTUBE_API_KEY
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()
            if "error" in data:
                print(f"API Error: {data['error']['message']}")
                return []
            if not data.get("items"):
                print(f"No results for '{query}' between {published_after} and {published_before}")
            return [video["id"]["videoId"] for video in data.get("items", [])]


async def get_video_details(video_ids):
    """Fetch view count and duration for videos."""
    if not video_ids:
        print("No video IDs found.")
        return []
    
    print(len(video_ids))

    url = "https://www.googleapis.com/youtube/v3/videos"
    params = {
        "part": "snippet,statistics,contentDetails",
        "id": ",".join(video_ids),
        "key": YOUTUBE_API_KEY
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            data = await response.json()

            videos = []
            for vid in data.get("items", []):
                duration = vid["contentDetails"]["duration"]  # e.g., "PT42S", "PT5M10S"
                duration_seconds = parse_duration(duration)

                if duration_seconds > 30:  # Only keep videos longer than 30s
                    videos.append({
                        "id": vid["id"],
                        "title": vid["snippet"]["title"],
                        "description": vid["snippet"]["description"],
                        "creator_name": vid["snippet"]["channelTitle"],
                        "view_count": int(vid["statistics"].get("viewCount", 1)),  # Default to 1 if missing
                        "published_at": vid["snippet"]["publishedAt"],
                    })
                else:
                    print(f"Skipping video (too short): {duration_seconds}s")
            return videos

def parse_duration(duration):
    """Convert YouTube duration format (ISO 8601) to seconds."""
    return isodate.parse_duration(duration).total_seconds()

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
    """Run YouTube scraping process for N random date ranges per query."""
    for query in SEARCH_QUERIES:
        for _ in range(1):
            published_after, published_before = get_random_date_range()
            print(f"Date range: {published_after} to {published_before}")
            try:
                video_ids = await search_youtube_videos(query, published_after, published_before)
                videos = await get_video_details(video_ids)
                await save_to_supabase(videos, query)
            except Exception as e:
                print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(run_scraping())
