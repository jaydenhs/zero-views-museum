#!/usr/bin/env python3
"""
Setup script for offline artworks museum.
This script sets up the local database, downloads images, and starts the API server.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors."""
    print(f"\n{'='*50}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*50}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print("✅ Success!")
        if result.stdout:
            print("Output:", result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {e}")
        if e.stdout:
            print("Output:", e.stdout)
        if e.stderr:
            print("Error:", e.stderr)
        return False

def check_requirements():
    """Check if required packages are installed."""
    print("Checking requirements...")
    
    try:
        import flask
        import aiohttp
        import aiofiles
        from PIL import Image
        import sqlite3
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing package: {e}")
        print("Please install requirements: pip install -r requirements.txt")
        return False

def setup_database():
    """Set up the SQLite database."""
    return run_command("python setup_database.py", "Setting up SQLite database")

def download_images(limit=None, batch_size=10):
    """Download images from Supabase."""
    cmd = f"python download_images.py --batch-size {batch_size}"
    if limit:
        cmd += f" --limit {limit}"
    
    return run_command(cmd, f"Downloading images (limit: {limit or 'unlimited'})")

def start_api_server():
    """Start the local API server."""
    print(f"\n{'='*50}")
    print("Starting Local API Server...")
    print("The server will run in the foreground.")
    print("Press Ctrl+C to stop the server.")
    print("Server will be available at: http://0.0.0.0:5000")
    print("API stats: http://0.0.0.0:5000/api/stats")
    print(f"{'='*50}")
    
    try:
        subprocess.run("python local_api_server.py", shell=True, check=True)
    except KeyboardInterrupt:
        print("\n\nServer stopped by user.")
    except subprocess.CalledProcessError as e:
        print(f"Error starting server: {e}")

def main():
    parser = argparse.ArgumentParser(description="Setup offline artworks museum")
    parser.add_argument("--skip-download", action="store_true", help="Skip image download step")
    parser.add_argument("--limit", type=int, help="Limit number of images to download")
    parser.add_argument("--batch-size", type=int, default=10, help="Number of concurrent downloads")
    parser.add_argument("--server-only", action="store_true", help="Only start the API server")
    
    args = parser.parse_args()
    
    print("🎨 Offline Artworks Museum Setup")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not os.path.exists("setup_database.py"):
        print("❌ Please run this script from the local-db directory")
        sys.exit(1)
    
    # Check requirements
    if not check_requirements():
        print("\nInstalling requirements...")
        if not run_command("pip install -r requirements.txt", "Installing Python packages"):
            sys.exit(1)
    
    if args.server_only:
        start_api_server()
        return
    
    # Setup database
    if not setup_database():
        print("❌ Database setup failed")
        sys.exit(1)
    
    # Download images (unless skipped)
    if not args.skip_download:
        if not download_images(limit=args.limit, batch_size=args.batch_size):
            print("❌ Image download failed")
            sys.exit(1)
    
    # Start API server
    start_api_server()

if __name__ == "__main__":
    main()
