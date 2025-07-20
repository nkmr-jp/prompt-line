const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '..', 'assets');
const svgPath = path.join(assetsDir, 'icon.svg');
const outputDir = path.join(__dirname, '..', 'build');

// Icon sizes needed for Windows .ico
const sizes = [16, 24, 32, 48, 64, 128, 256];

async function createWindowsIcon() { // eslint-disable-line no-unused-vars
  console.log('Creating Windows icon from SVG...');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create PNG files for each size
  const pngFiles = [];
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    console.log(`Creating ${size}x${size} PNG...`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      pngFiles.push(outputPath);
    } catch (error) {
      console.error(`Error creating ${size}x${size} PNG:`, error);
      process.exit(1);
    }
  }
  
  // Create .ico file using ImageMagick
  const icoPath = path.join(outputDir, 'icon.ico');
  const command = `magick convert ${pngFiles.join(' ')} ${icoPath}`;
  
  try {
    console.log('Creating .ico file with ImageMagick...');
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ Windows icon created at: ${icoPath}`);
    
    // Copy to assets directory
    const assetsIcoPath = path.join(assetsDir, 'Prompt-Line.ico');
    fs.copyFileSync(icoPath, assetsIcoPath);
    console.log(`✅ Icon copied to: ${assetsIcoPath}`);
    
    // Clean up temporary PNG files
    for (const pngFile of pngFiles) {
      fs.unlinkSync(pngFile);
    }
    
  } catch (error) {
    console.error('Error creating .ico file:', error);
    console.log('\nMake sure ImageMagick is installed:');
    console.log('Download from: https://imagemagick.org/script/download.php#windows');
    process.exit(1);
  }
}

// Alternative method using png-to-ico package (if ImageMagick is not available)
async function createWindowsIconAlternative() {
  console.log('Creating Windows icon using png-to-ico...');
  
  try {
    const pngToIco = require('png-to-ico');
    
    // Create 256x256 PNG first
    const pngPath = path.join(outputDir, 'icon-256.png');
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(pngPath);
    
    // Convert to ICO
    const buf = await pngToIco(pngPath);
    const icoPath = path.join(assetsDir, 'Prompt-Line.ico');
    fs.writeFileSync(icoPath, buf);
    
    console.log(`✅ Windows icon created at: ${icoPath}`);
    
    // Clean up
    fs.unlinkSync(pngPath);
    
  } catch (error) {
    console.error('Error with png-to-ico method:', error);
    console.log('Install png-to-ico: npm install --save-dev png-to-ico');
  }
}

// Check which method to use
async function main() {
  try {
    require.resolve('sharp');
    require.resolve('png-to-ico');
    await createWindowsIconAlternative();
  } catch (e) {
    console.error('Required packages not installed:', e.message);
    console.log('Run: npm install --save-dev sharp png-to-ico');
    process.exit(1);
  }
}

main().catch(console.error);