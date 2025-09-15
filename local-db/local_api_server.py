#!/usr/bin/env python3
"""
Local API server for offline artworks museum.
Serves images and provides database operations similar to Supabase.
"""

import os
import sqlite3
import json
from pathlib import Path
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
import mimetypes
import ssl

app = Flask(__name__)
CORS(app, origins="*", 
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"])

# Configuration
DB_PATH = "artworks.db"
IMAGES_DIR = "images"
# HOST = "169.254.155.87"
HOST = "0.0.0.0" 
# HOST = "172.20.10.13"
PORT = 5001 
CERT_PATH = "../certificates/vr-museum.pem"
KEY_PATH = "../certificates/vr-museum-key.pem"

def get_db_connection():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    return conn

def get_unviewed_images(limit=4):
    """Get unviewed images from local database."""
    conn = get_db_connection()
    
    cursor = conn.execute('''
        SELECT * FROM artworks_cc 
        WHERE viewed = FALSE AND local_path IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
    ''', (limit,))
    
    results = cursor.fetchall()
    conn.close()
    
    # Convert to list of dictionaries
    return [dict(row) for row in results]

def mark_images_as_viewed(image_ids):
    """Mark images as viewed in local database."""
    conn = get_db_connection()
    
    placeholders = ','.join(['?' for _ in image_ids])
    conn.execute(f'''
        UPDATE artworks_cc 
        SET viewed = TRUE 
        WHERE id IN ({placeholders})
    ''', image_ids)
    
    conn.commit()
    conn.close()

def get_image_info(image_id):
    """Get image information by ID."""
    conn = get_db_connection()
    
    cursor = conn.execute('''
        SELECT * FROM artworks_cc 
        WHERE id = ?
    ''', (image_id,))
    
    result = cursor.fetchone()
    conn.close()
    
    return dict(result) if result else None

@app.route('/')
def index():
    """API status endpoint."""
    return jsonify({
        "status": "online",
        "service": "Local Artworks API",
        "version": "1.0.0"
    })

@app.route('/health')
def health():
    """Health check endpoint."""
    try:
        conn = get_db_connection()
        cursor = conn.execute("SELECT COUNT(*) FROM artworks_cc")
        count = cursor.fetchone()[0]
        conn.close()
        
        return jsonify({
            "status": "healthy",
            "database": "connected",
            "total_artworks": count
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/api/artworks/unviewed')
def get_unviewed():
    """Get unviewed artworks (equivalent to Supabase RPC)."""
    try:
        limit = request.args.get('limit', 4, type=int)
        images = get_unviewed_images(limit)
        
        # Convert local paths to API URLs
        for image in images:
            if image['local_path']:
                image['url'] = f"https://{request.host}/api/images/{image['id']}"
        
        return jsonify(images)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/artworks/<artwork_id>')
def get_artwork(artwork_id):
    """Get specific artwork by ID."""
    try:
        artwork = get_image_info(artwork_id)
        if not artwork:
            return jsonify({"error": "Artwork not found"}), 404
        
        # Convert local path to API URL
        if artwork['local_path']:
            artwork['url'] = f"https://{request.host}/api/images/{artwork['id']}"
        
        return jsonify(artwork)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/artworks/<artwork_id>/view', methods=['POST'])
def mark_as_viewed(artwork_id):
    """Mark a single artwork as viewed."""
    try:
        mark_images_as_viewed([artwork_id])
        return jsonify({"success": True, "message": "Artwork marked as viewed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/artworks/view', methods=['POST'])
def mark_multiple_as_viewed():
    """Mark multiple artworks as viewed."""
    try:
        data = request.get_json()
        image_ids = data.get('ids', [])
        
        if not image_ids:
            return jsonify({"error": "No image IDs provided"}), 400
        
        mark_images_as_viewed(image_ids)
        return jsonify({"success": True, "message": f"Marked {len(image_ids)} artworks as viewed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/images/<artwork_id>')
def serve_image(artwork_id):
    """Serve image file by artwork ID."""
    try:
        artwork = get_image_info(artwork_id)
        if not artwork or not artwork['local_path']:
            return jsonify({"error": "Image not found"}), 404
        
        image_path = artwork['local_path']
        
        # Check if file exists
        if not os.path.exists(image_path):
            return jsonify({"error": "Image file not found on disk"}), 404
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type:
            mime_type = 'image/jpeg'  # Default
        
        response = send_file(
            image_path,
            mimetype=mime_type,
            as_attachment=False
        )
        # CORS headers already set through flask_cors
        
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/images/test')
def serve_test_image():
    """Serve image file by artwork ID."""
    try:
        artwork_id = "0e1fffd4-0dc2-461b-ac87-617d47a1d238"
        artwork = get_image_info(artwork_id)
        if not artwork or not artwork['local_path']:
            return jsonify({"error": "Image not found"}), 404
        
        image_path = artwork['local_path']
        
        # Check if file exists
        if not os.path.exists(image_path):
            return jsonify({"error": "Image file not found on disk"}), 404
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(image_path)
        if not mime_type:
            mime_type = 'image/jpeg'  # Default
        
        response = send_file(
            image_path,
            mimetype=mime_type,
            as_attachment=False
        )
        # CORS headers already set through flask_cors
        
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stats')
def get_stats():
    """Get database statistics."""
    try:
        conn = get_db_connection()
        
        # Total artworks
        cursor = conn.execute("SELECT COUNT(*) FROM artworks_cc")
        total = cursor.fetchone()[0]
        
        # Viewed artworks
        cursor = conn.execute("SELECT COUNT(*) FROM artworks_cc WHERE viewed = TRUE")
        viewed = cursor.fetchone()[0]
        
        # Unviewed artworks
        cursor = conn.execute("SELECT COUNT(*) FROM artworks_cc WHERE viewed = FALSE")
        unviewed = cursor.fetchone()[0]
        
        # Artworks with local images
        cursor = conn.execute("SELECT COUNT(*) FROM artworks_cc WHERE local_path IS NOT NULL")
        with_images = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            "total_artworks": total,
            "viewed_artworks": viewed,
            "unviewed_artworks": unviewed,
            "artworks_with_images": with_images,
            "viewed_percentage": round((viewed / total * 100) if total > 0 else 0, 2)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset-viewed', methods=['POST'])
def reset_viewed():
    """Reset all artworks to unviewed status."""
    try:
        conn = get_db_connection()
        conn.execute("UPDATE artworks_cc SET viewed = FALSE")
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": "All artworks reset to unviewed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    # Ensure database exists
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}. Please run setup_database.py first.")
        exit(1)
    
    # Ensure images directory exists
    if not os.path.exists(IMAGES_DIR):
        print(f"Images directory not found at {IMAGES_DIR}. Please run download_images.py first.")
        exit(1)
    
    # Ensure certificates exist
    if not os.path.exists(CERT_PATH) or not os.path.exists(KEY_PATH):
        print(f"SSL certificates not found. Please ensure certificates are in place.")
        print(f"Expected: {CERT_PATH} and {KEY_PATH}")
        exit(1)
    
    print(f"Starting Local Artworks API Server with HTTPS...")
    print(f"Database: {DB_PATH}")
    print(f"Images directory: {IMAGES_DIR}")
    print(f"Server will be available at: https://{HOST}:{PORT}")
    print(f"API documentation: https://{HOST}:{PORT}/api/stats")
    print(f"Using trusted certificates for VR headset compatibility")
    
    try:
        # Create SSL context with trusted certificates
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(CERT_PATH, KEY_PATH)
        
        # Add better error handling and logging
        import logging
        logging.basicConfig(level=logging.INFO)
        
        app.run(
            host=HOST, 
            port=PORT, 
            debug=True,
            ssl_context=context,
            threaded=True,  # Enable threading for better performance
            use_reloader=False  # Disable reloader to prevent issues
        )
    except Exception as e:
        print(f"Failed to start server: {e}")
        exit(1)
