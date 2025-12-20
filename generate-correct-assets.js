import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Correct icon sizes for Android (dp values)
// Source: 512.png (512x512)
const iconSizes = [
  { name: 'ldpi', size: 36 },
  { name: 'mdpi', size: 48 },
  { name: 'hdpi', size: 72 },
  { name: 'xhdpi', size: 96 },
  { name: 'xxhdpi', size: 144 },
  { name: 'xxxhdpi', size: 192 },
];

// Correct splash screen sizes for Android
// Source: 2800.png (2800x2800) - splash should be square
const splashSizes = [
  { name: 'mdpi-port', width: 320, height: 470, density: 'mdpi', orient: 'port' },
  { name: 'hdpi-port', width: 480, height: 640, density: 'hdpi', orient: 'port' },
  { name: 'xhdpi-port', width: 720, height: 960, density: 'xhdpi', orient: 'port' },
  { name: 'xxhdpi-port', width: 1080, height: 1440, density: 'xxhdpi', orient: 'port' },
  { name: 'xxxhdpi-port', width: 1440, height: 1920, density: 'xxxhdpi', orient: 'port' },

  { name: 'mdpi-land', width: 470, height: 320, density: 'mdpi', orient: 'land' },
  { name: 'hdpi-land', width: 640, height: 480, density: 'hdpi', orient: 'land' },
  { name: 'xhdpi-land', width: 960, height: 720, density: 'xhdpi', orient: 'land' },
  { name: 'xxhdpi-land', width: 1440, height: 1080, density: 'xxhdpi', orient: 'land' },
  { name: 'xxxhdpi-land', width: 1920, height: 1440, density: 'xxxhdpi', orient: 'land' },
];

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error.message);
  }
}

async function generateIcons() {
  console.log('📱 Generating App Icons (from 512.png)...\n');

  const sourceIcon = path.join(__dirname, '512.png');

  try {
    await fs.stat(sourceIcon);
  } catch (error) {
    console.error('❌ 512.png not found!');
    return false;
  }

  for (const icon of iconSizes) {
    const outDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `mipmap-${icon.name}`);
    await ensureDir(outDir);

    const outPath = path.join(outDir, 'ic_launcher.png');

    try {
      await sharp(sourceIcon)
        .resize(icon.size, icon.size, { fit: 'cover' })
        .png()
        .toFile(outPath);

      console.log(`✅ mipmap-${icon.name}/ic_launcher.png (${icon.size}×${icon.size})`);
    } catch (error) {
      console.error(`❌ Failed: mipmap-${icon.name} - ${error.message}`);
      return false;
    }
  }

  return true;
}

async function generateSplashes() {
  console.log('\n🎨 Generating Splash Screens (from 2800.png)...\n');

  const sourceSplash = path.join(__dirname, '2800.png');

  try {
    await fs.stat(sourceSplash);
  } catch (error) {
    console.error('❌ 2800.png not found!');
    return false;
  }

  for (const splash of splashSizes) {
    const orient = splash.orient === 'port' ? 'port' : 'land';
    const outDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res', `drawable-${orient}-${splash.density}`);
    await ensureDir(outDir);

    const outPath = path.join(outDir, 'splash.png');

    try {
      await sharp(sourceSplash)
        .resize(splash.width, splash.height, { fit: 'cover' })
        .png()
        .toFile(outPath);

      console.log(`✅ drawable-${orient}-${splash.density}/splash.png (${splash.width}×${splash.height})`);
    } catch (error) {
      console.error(`❌ Failed: drawable-${orient}-${splash.density} - ${error.message}`);
      return false;
    }
  }

  return true;
}

async function main() {
  console.log('🚀 CORRECT Capacitor Asset Generator\n');
  console.log('Source Images:');
  console.log('  • 512.png (512×512) → App Icons');
  console.log('  • 2800.png (2800×2800) → Splash Screens\n');

  const iconsOk = await generateIcons();
  const splashesOk = await generateSplashes();

  if (iconsOk && splashesOk) {
    console.log('\n✅ ALL ASSETS GENERATED CORRECTLY!\n');
    console.log('Next steps:');
    console.log('  1. npm run build');
    console.log('  2. npx cap sync android');
    console.log('  3. npx cap open android\n');
  } else {
    console.log('\n❌ Asset generation failed!');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
