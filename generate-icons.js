#!/usr/bin/env node
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define icon sizes for Android densities
const iconSizes = [
  { name: 'ldpi', size: 36 },
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
];

const sourceImage = path.join(__dirname, '512.png');

async function generateIcons() {
  try {
    console.log('Generating Android app icons from 512.png...\n');

    for (const density of iconSizes) {
      const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${density.name}`);

      // Ensure directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, 'ic_launcher.png');

      await sharp(sourceImage)
        .resize(density.size, density.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${density.name}: ${density.size}x${density.size}`);
    }

    console.log('\n✨ All Android app icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
