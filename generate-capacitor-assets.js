import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Android icon sizes (in dp, scale by density)
const androidIconSizes = [
  { name: 'ldpi', size: 36, density: 0.75 },
  { name: 'mdpi', size: 48, density: 1 },
  { name: 'hdpi', size: 72, density: 1.5 },
  { name: 'xhdpi', size: 96, density: 2 },
  { name: 'xxhdpi', size: 144, density: 3 },
  { name: 'xxxhdpi', size: 192, density: 4 },
];

// Android splash screen sizes (portrait and landscape)
const androidSplashSizes = [
  // Portrait
  { name: 'mdpi-port', width: 320, height: 470, orientation: 'portrait', density: 'mdpi' },
  { name: 'hdpi-port', width: 480, height: 640, orientation: 'portrait', density: 'hdpi' },
  { name: 'xhdpi-port', width: 720, height: 960, orientation: 'portrait', density: 'xhdpi' },
  { name: 'xxhdpi-port', width: 1080, height: 1440, orientation: 'portrait', density: 'xxhdpi' },
  { name: 'xxxhdpi-port', width: 1440, height: 1920, orientation: 'portrait', density: 'xxxhdpi' },

  // Landscape
  { name: 'mdpi-land', width: 470, height: 320, orientation: 'landscape', density: 'mdpi' },
  { name: 'hdpi-land', width: 640, height: 480, orientation: 'landscape', density: 'hdpi' },
  { name: 'xhdpi-land', width: 960, height: 720, orientation: 'landscape', density: 'xhdpi' },
  { name: 'xxhdpi-land', width: 1440, height: 1080, orientation: 'landscape', density: 'xxhdpi' },
  { name: 'xxxhdpi-land', width: 1920, height: 1440, orientation: 'landscape', density: 'xxxhdpi' },
];

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
  }
}

async function generateAndroidIcons() {
  console.log('📱 Generating Android app icons...');

  const iconSourcePath = path.join(__dirname, '2800.png');

  try {
    const stats = await fs.stat(iconSourcePath);
    console.log(`Found source icon: 2800.png (${stats.size} bytes)`);
  } catch (error) {
    console.error('❌ Source image 2800.png not found!');
    return false;
  }

  for (const size of androidIconSizes) {
    const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${size.name}`);
    await ensureDirectory(outputDir);

    const outputPath = path.join(outputDir, 'ic_launcher.png');

    try {
      await sharp(iconSourcePath)
        .resize(size.size, size.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated mipmap-${size.name}/ic_launcher.png (${size.size}x${size.size})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${size.name} icon:`, error.message);
    }
  }

  return true;
}

async function generateAndroidSplash() {
  console.log('\n🎨 Generating Android splash screens...');

  const splashSourcePath = path.join(__dirname, '2800.png');

  try {
    const stats = await fs.stat(splashSourcePath);
    console.log(`Found source splash: 2800.png (${stats.size} bytes)`);
  } catch (error) {
    console.error('❌ Source image 2800.png not found!');
    return false;
  }

  for (const splash of androidSplashSizes) {
    // Determine drawable directory
    const drawableDir = splash.orientation === 'portrait'
      ? `drawable-port-${splash.density}`
      : `drawable-land-${splash.density}`;

    const outputDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', drawableDir);
    await ensureDirectory(outputDir);

    const outputPath = path.join(outputDir, 'splash.png');

    try {
      // Create splash with app icon centered and background color
      const metadata = await sharp(splashSourcePath).metadata();

      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 3,
          background: { r: 10, g: 15, b: 30 } // Dark blue background matching app theme
        }
      })
        .composite([
          {
            input: await sharp(splashSourcePath)
              .resize(Math.min(splash.width, splash.height) * 0.5, Math.min(splash.width, splash.height) * 0.5, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
              })
              .png()
              .toBuffer(),
            gravity: 'center'
          }
        ])
        .png()
        .toFile(outputPath);

      console.log(`✓ Generated ${drawableDir}/splash.png (${splash.width}x${splash.height})`);
    } catch (error) {
      console.error(`✗ Failed to generate splash (${splash.name}):`, error.message);
    }
  }

  return true;
}

async function main() {
  console.log('🚀 Capacitor Asset Generator\n');
  console.log('Source: 2800.png');
  console.log('Target: Android resources\n');

  const iconSuccess = await generateAndroidIcons();
  const splashSuccess = await generateAndroidSplash();

  if (iconSuccess && splashSuccess) {
    console.log('\n✅ All assets generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npx cap sync android');
    console.log('2. Run: npx cap open android');
    console.log('3. Build and run on device/emulator');
  } else {
    console.log('\n❌ Some assets failed to generate. Check errors above.');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
