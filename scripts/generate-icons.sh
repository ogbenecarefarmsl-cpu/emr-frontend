#!/bin/bash

# Icon generation script for PWA
# Requires ImageMagick to be installed

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed. Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Create a base logo if it doesn't exist
BASE_LOGO="public/logo.png"
if [ ! -f "$BASE_LOGO" ]; then
    echo "Creating base logo..."
    # Create a simple logo with text (you should replace this with your actual logo)
    convert -size 1024x1024 xc:none \
        -fill "#0f172a" \
        -draw "roundrectangle 50,50 974,974 100,100" \
        -fill white \
        -font Arial-Bold -pointsize 200 \
        -gravity center -annotate +0-100 "H" \
        -pointsize 80 -annotate +0+100 "HARBOUR" \
        -pointsize 50 -annotate +0+180 "DIAGNOSTICS" \
        "$BASE_LOGO"
    echo "Base logo created at $BASE_LOGO"
fi

echo "Generating PWA icons from $BASE_LOGO..."

# Generate 192x192 icon
convert "$BASE_LOGO" -resize 192x192 public/icon-192.png
echo "✓ Generated icon-192.png"

# Generate 512x512 icon
convert "$BASE_LOGO" -resize 512x512 public/icon-512.png
echo "✓ Generated icon-512.png"

# Generate Apple touch icon (180x180)
convert "$BASE_LOGO" -resize 180x180 public/apple-touch-icon.png
echo "✓ Generated apple-touch-icon.png"

# Generate favicon (32x32)
convert "$BASE_LOGO" -resize 32x32 public/favicon.ico
echo "✓ Generated favicon.ico"

# Generate maskable icons (with safe zone padding)
convert "$BASE_LOGO" -resize 192x192 -gravity center -extent 192x192 public/icon-192-maskable.png
echo "✓ Generated icon-192-maskable.png"

convert "$BASE_LOGO" -resize 512x512 -gravity center -extent 512x512 public/icon-512-maskable.png
echo "✓ Generated icon-512-maskable.png"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Generated files:"
echo "  - public/icon-192.png"
echo "  - public/icon-512.png"
echo "  - public/apple-touch-icon.png"
echo "  - public/favicon.ico"
echo "  - public/icon-192-maskable.png"
echo "  - public/icon-512-maskable.png"
