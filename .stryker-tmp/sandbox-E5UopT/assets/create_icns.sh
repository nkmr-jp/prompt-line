#!/bin/bash

# Create iconset directory
mkdir -p "Prompt-Line.iconset"

# Define sizes needed for macOS icon
sizes=(16 32 64 128 256 512 1024)

echo "Creating PNG files from SVG..."

# Create PNG files for each size
for size in "${sizes[@]}"; do
    # Normal resolution
    if [ $size -le 512 ]; then
        echo "Creating icon_${size}x${size}.png"
        # Using qlmanage (built-in macOS) to convert SVG to PNG
        qlmanage -t -s $size -o . icon.svg > /dev/null 2>&1
        mv icon.svg.png "Prompt-Line.iconset"/icon_${size}x${size}.png
    fi
    
    # @2x resolution for Retina displays
    if [ $size -le 512 ]; then
        size2x=$((size * 2))
        echo "Creating icon_${size}x${size}@2x.png"
        qlmanage -t -s $size2x -o . icon.svg > /dev/null 2>&1
        mv icon.svg.png "Prompt-Line.iconset"/icon_${size}x${size}@2x.png
    fi
done

# Alternative method using rsvg-convert if available
if command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert for better quality..."
    for size in "${sizes[@]}"; do
        if [ $size -le 512 ]; then
            rsvg-convert -w $size -h $size icon.svg -o "Prompt-Line.iconset"/icon_${size}x${size}.png
            size2x=$((size * 2))
            if [ $size2x -le 1024 ]; then
                rsvg-convert -w $size2x -h $size2x icon.svg -o "Prompt-Line.iconset"/icon_${size}x${size}@2x.png
            fi
        fi
    done
fi

# Create the icns file
echo "Creating Prompt-Line.icns..."
iconutil -c icns "Prompt-Line.iconset"

# Clean up
echo "Cleaning up temporary files..."
rm -rf "Prompt-Line.iconset"

echo "Done! Prompt-Line.icns has been created."

# Generate tray icons
echo "Generating tray icons..."
if command -v rsvg-convert &> /dev/null; then
    echo "Creating tray icons: 22x22 and 44x44 pixels"
    rsvg-convert -w 22 -h 22 icon-tray.svg -o icon-tray-22.png
    rsvg-convert -w 44 -h 44 icon-tray.svg -o icon-tray-44.png
    echo "Tray icons created: icon-tray-22.png and icon-tray-44.png"
else
    echo "Warning: rsvg-convert not found. Please install with: brew install librsvg"
fi