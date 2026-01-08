const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateLogoPNG() {
  const svgPath = path.join(__dirname, '../public/logo-mo-with-text.svg');
  const pngPath = path.join(__dirname, '../public/logo-mo-generated.png');

  console.log('Reading SVG from:', svgPath);

  try {
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(pngPath);

    console.log('✓ Successfully generated logo-mo-generated.png');
  } catch (error) {
    console.error('Error generating PNG:', error);
    process.exit(1);
  }
}

generateLogoPNG();
