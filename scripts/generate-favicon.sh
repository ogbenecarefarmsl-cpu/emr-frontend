#!/bin/bash

# Generate Favicon from Logo
# This script converts logo_resized.png to various favicon formats

echo "🎨 Generating favicons from logo..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo "Please install it:"
    echo "  - Windows: choco install imagemagick"
    echo "  - Mac: brew install imagemagick"
    echo "  - Linux: sudo apt-get install imagemagick"
    exit 1
fi

cd "$(dirname "$0")/.."

# Source logo
LOGO="public/logo_resized.png"

if [ ! -f "$LOGO" ]; then
    echo "❌ Logo file not found: $LOGO"
    exit 1
fi

echo "📁 Source: $LOGO"

# Generate favicon.ico (16x16, 32x32, 48x48)
echo "🔨 Generating favicon.ico..."
convert "$LOGO" -resize 16x16 -background none -flatten public/favicon-16.png
convert "$LOGO" -resize 32x32 -background none -flatten public/favicon-32.png
convert "$LOGO" -resize 48x48 -background none -flatten public/favicon-48.png
convert public/favicon-16.png public/favicon-32.png public/favicon-48.png public/favicon.ico
rm public/favicon-16.png public/favicon-32.png public/favicon-48.png

# Generate icon-192.png (for PWA)
echo "🔨 Generating icon-192.png..."
convert "$LOGO" -resize 192x192 -background none -flatten public/icon-192.png

# Generate icon-512.png (for PWA)
echo "🔨 Generating icon-512.png..."
convert "$LOGO" -resize 512x512 -background none -flatten public/icon-512.png

# Generate apple-touch-icon.png
echo "🔨 Generating apple-touch-icon.png..."
convert "$LOGO" -resize 180x180 -background none -flatten public/apple-touch-icon.png

echo "✅ Favicons generated successfully!"
echo ""
echo "Generated files:"
echo "  ✓ favicon.ico (16x16, 32x32, 48x48)"
echo "  ✓ icon-192.png"
echo "  ✓ icon-512.png"
echo "  ✓ apple-touch-icon.png"
