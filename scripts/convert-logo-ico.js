const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logoIcoPath = path.join(__dirname, '../src/assets/logo.ico');
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const androidResPath = path.join(__dirname, '../android/app/src/main/res');

async function convertLogo() {
  try {
    // Check if logo.ico exists
    if (!fs.existsSync(logoIcoPath)) {
      console.log('logo.ico not found, using yometel-logo.png as fallback');
      const fallbackLogo = path.join(__dirname, '../src/assets/yometel-logo.png');
      if (fs.existsSync(fallbackLogo)) {
        for (const [folder, size] of Object.entries(sizes)) {
          const folderPath = path.join(androidResPath, folder);
          if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
          }
          await sharp(fallbackLogo)
            .resize(size, size)
            .png()
            .toFile(path.join(folderPath, 'ic_launcher.png'));
          await sharp(fallbackLogo)
            .resize(size, size)
            .png()
            .toFile(path.join(folderPath, 'ic_launcher_round.png'));
          console.log(`✓ Created ${size}x${size} icons in ${folder}`);
        }
      }
      return;
    }

    // Try to convert ICO file
    // Note: Sharp may not support ICO directly, so we'll try and fallback if needed
    for (const [folder, size] of Object.entries(sizes)) {
      const folderPath = path.join(androidResPath, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      
      try {
        await sharp(logoIcoPath)
          .resize(size, size)
          .png()
          .toFile(path.join(folderPath, 'ic_launcher.png'));
        await sharp(logoIcoPath)
          .resize(size, size)
          .png()
          .toFile(path.join(folderPath, 'ic_launcher_round.png'));
        console.log(`✓ Created ${size}x${size} icons in ${folder} from logo.ico`);
      } catch (error) {
        // If sharp can't handle ICO, use fallback
        console.log(`Warning: Could not convert ICO directly, using fallback for ${folder}`);
        const fallbackLogo = path.join(__dirname, '../src/assets/yometel-logo.png');
        if (fs.existsSync(fallbackLogo)) {
          await sharp(fallbackLogo)
            .resize(size, size)
            .png()
            .toFile(path.join(folderPath, 'ic_launcher.png'));
          await sharp(fallbackLogo)
            .resize(size, size)
            .png()
            .toFile(path.join(folderPath, 'ic_launcher_round.png'));
        }
      }
    }
    console.log('Logo conversion complete!');
  } catch (error) {
    console.error('Error converting logo:', error);
  }
}

convertLogo();
