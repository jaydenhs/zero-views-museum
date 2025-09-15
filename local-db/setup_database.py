#!/usr/bin/env python3
"""
Local database setup for offline artworks museum.
Creates SQLite database with the same structure as Supabase artworks_cc table.
"""

import sqlite3
import os
from pathlib import Path

def create_database(db_path="artworks.db"):
    """Create SQLite database with artworks_cc table structure."""
    
    # Ensure directory exists (only if there's a directory component)
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create artworks_cc table with same structure as Supabase
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artworks_cc (
            id TEXT PRIMARY KEY,
            media_type TEXT NOT NULL,
            source TEXT NOT NULL,
            creator_name TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            query TEXT,
            view_url TEXT,
            created_at TEXT,
            entry_created_at TEXT NOT NULL,
            viewed BOOLEAN DEFAULT FALSE,
            local_path TEXT,
            width INTEGER,
            height INTEGER
        )
    ''')
    
    # Create index for faster queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_viewed ON artworks_cc(viewed)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_query ON artworks_cc(query)')
    
    conn.commit()
    conn.close()
    
    print(f"Database created successfully at {db_path}")

def create_stored_procedures(db_path="artworks.db"):
    """Create stored procedures equivalent to Supabase RPC functions."""
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create a view for unviewed images (equivalent to get_unviewed_flickr_images_cc RPC)
    cursor.execute('''
        CREATE VIEW IF NOT EXISTS unviewed_images AS
        SELECT * FROM artworks_cc 
        WHERE viewed = FALSE 
        ORDER BY RANDOM()
    ''')
    
    conn.commit()
    conn.close()
    
    print("Stored procedures and views created successfully")

if __name__ == "__main__":
    db_path = "artworks.db"
    create_database(db_path)
    create_stored_procedures(db_path)
