import os
import aiohttp
import asyncio
from dotenv import load_dotenv
from supabase import create_client
import uuid
import datetime
import time
from tqdm import tqdm

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
]

# COMPLETED_QUERIES = [
#     "photography",
#     "digital art",
#     "abstract art",
#     "contemporary art",
#     "painting",
  # "street photography",
  # "landscape photography",
  # "portrait photography",
  # "fine art photography",
  # "modern art",
  # "minimalist art",
  # "conceptual art",
  # "collage art",
  # "surrealism",
  # "pop art",
  # "impressionism",
  # "expressionism",
  # "installation art",
  # "mixed media art",
  # "black and white photography",
  # "macro photography",
  # "nature photography",
  # "urban photography",
  # "experimental photography",
  # "still life photography",
  # "documentary photography",
  # "visual art",
  # "photojournalism",
  # "cinematic photography",
  # "colorful art",
    #   "art brut",
    # "futurism in art",
    # "art deco posters",
    # "Japanese woodblock prints",
    # "digital collage techniques",
    # "aerial photography art",
    # "neon art installations",
    # "textile art contemporary",
    # "kinetic sculpture",
    # "automata art",
    # "AI-generated art ethics",
    # "interactive digital installations",
    # "zine art culture",
    # "graffiti typography",
    # "glitch art aesthetics",
    # "data-driven art projects",
    # "bio art examples",
    # "eco art movements",
    # "video art installations",
    # "generative art algorithms",
    # "performance art documentation",
    # "lowbrow art movement",
    # "art and machine learning",
    # "political satire in visual art",
    # "immersive art experiences",
    #   "fabrics",
    # "textiles",
    # "pottery",
    # "ceramics",
    # "glass",
    # "metalwork",
    # "woodworking",
    # "sculpture",
    # "installation",
    # "performance",
    # "3d printing",
    # "3d modeling",
    # # Traditional & Fine Arts
    # "printmaking",
    # "calligraphy",
    # "hand lettering",
    # "bookbinding",
    # "book arts",
    # "paper crafts",
    # "origami",
    # "quilling",
    # "paper cutting",
    # "mosaic art",
    # "tile work",
    # "stained glass",
    # "glass blowing",
    # "jewelry making",
    # "metal smithing",
    # "leather working",
    # "tooling",
    # # Contemporary & Digital Arts
    # "NFT art",
    # "blockchain art",
    # "generative art",
    # "algorithmic design",
    # "motion graphics",
    # "animation",
    # "web art",
    # "net art",
    # "virtual reality art",
    # "augmented reality art",
    # "sound art",
    # "audio installations",
    # "light art",
    # "projection mapping",
    # # Mixed Media & Experimental
    # "assemblage art",
    # "found object art",
    # "collage techniques",
    # "mixed media",
    # "fiber arts",
    # "environmental art",
    # "land art",
    # "performance documentation",
    # "participatory installations",
    # "bio art",
    # "living sculptures",
    # # Cultural & Regional Arts
    # "indigenous art",
    # "tribal crafts",
    # "folk art",
    # "naive art",
    # "outsider art",
    # "street art",
    # "urban murals",
    # "graffiti art",
    # "street culture",
    # "Asian art forms",
    # "sumi-e",
    # "ukiyo-e",
    # "African art",
    # "tribal masks",
    # # Niche & Specialized
    # "miniature art",
    # "dollhouse art",
    # "model making",
    # "dioramas",
    # "cosplay art",
    # "costume design",
    # "tattoo art",
    # "body art",
    # "culinary art",
    # "food sculpture",
    # "fashion art",
    # "wearable art",
    # "architectural art",
    # "building design",
# ]

async def search_flickr_images(session, query, min_upload_date, max_upload_date, per_page=500):
    """Search Flickr for photos matching the query and date range."""
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
        "safe_search": 1,
        "license": "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16" # Exclude All Rights Reserved
    }

    async with session.get(url, params=params) as response:
        response_data = await response.json()
        images = response_data.get("photos", {}).get("photo", [])
        zero_view_images = [img for img in images if int(img.get("views", 1)) == 0]
        return zero_view_images

async def get_flickr_realname(session, user_id):
    """Fetch the real name of a Flickr user by their NSID."""
    url = "https://api.flickr.com/services/rest/"
    params = {
        "method": "flickr.people.getInfo",
        "api_key": FLICKR_API_KEY,
        "user_id": user_id,
        "format": "json",
        "nojsoncallback": 1
    }

    try:
        async with session.get(url, params=params) as response:
            response_data = await response.json()
            person = response_data.get("person", {})
            realname = person.get("realname", {}).get("_content", None)
            return realname if realname else None
    except:
        return None

async def save_to_supabase(session, image_data, query):
    """Insert image metadata into Supabase."""
    if not image_data:
        return

    # Concurrently fetch realnames
    user_ids = [img.get("owner", "Unknown") for img in image_data]
    realname_tasks = [get_flickr_realname(session, uid) for uid in user_ids]
    realnames = await asyncio.gather(*realname_tasks)

    # Prepare entries
    entries = []
    for img, realname in zip(image_data, realnames):
        flickr_page_url = f"https://www.flickr.com/photos/{img['owner']}/{img['id']}"

        img_entry = {
            "id": str(uuid.uuid4()),
            "media_type": "image",
            "source": "Flickr",
            "creator_name": realname or img.get("ownername", "Unknown"),
            "url": f"https://live.staticflickr.com/{img['server']}/{img['id']}_{img['secret']}_b.jpg",
            "title": img.get("title", "Untitled"),
            "description": img.get("description", {}).get("_content", "No description"),
            "query": query,
            "view_url": flickr_page_url,
            "created_at": img.get("datetaken", "Unknown"),
            "entry_created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        entries.append(img_entry)

    # Insert batch (adjust if Supabase has size limits)
    try:
        supabase.table("artworks_cc").insert(entries).execute()
        tqdm.write(f"Inserted {len(entries)} images for query '{query}'")
    except Exception as e:
        tqdm.write(f"Supabase insert failed: {e}")

async def run_scraping():
    """Run the scraping process with cautious concurrency."""
    start_date = datetime.datetime(2011, 1, 1)
    end_date = datetime.datetime.now()
    delta = datetime.timedelta(weeks=4)

    # Generate date ranges
    date_ranges = []
    current_date = start_date
    while current_date < end_date:
        next_date = current_date + delta
        date_ranges.append((current_date.strftime("%Y-%m-%d"), next_date.strftime("%Y-%m-%d")))
        current_date = next_date

    async with aiohttp.ClientSession() as session:
        for query in tqdm(SEARCH_QUERIES, desc="Search Queries"):
            for min_date, max_date in tqdm(date_ranges, desc=f"Date ranges for '{query}'", leave=False):
                try:
                    images = await search_flickr_images(session, query, min_date, max_date)

                    if isinstance(images, dict) and "stat" in images and images["stat"] == "fail":
                        error_code = images.get("code", None)
                        error_msg = images.get("message", "Unknown error")

                        if error_code == 429:
                            tqdm.write(f"Rate limit exceeded. Sleeping for 1 hour...")
                            await asyncio.sleep(3600)
                            break

                        tqdm.write(f"Flickr API error {error_code}: {error_msg}")
                        break

                    await save_to_supabase(session, images, query)

                except Exception as e:
                    tqdm.write(f"Unexpected error: {e}. Skipping range.")
                    continue

if __name__ == "__main__":
    asyncio.run(run_scraping())
