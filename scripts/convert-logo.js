const fs = require('fs');
const path = require('path');

// Since we can't easily convert ICO to PNG without additional tools,
// we'll copy yometel-logo.png as a temporary solution
// In production, you would use ImageMagick or another tool to convert logo.ico

const sourceLogo = path.join(__dirname, '../src/assets/yometel-logo.png');
const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const androidResPath = path.join(__dirname, '../android/app/src/main/res');

// Create directories and copy logo
Object.keys(sizes).forEach((folder) => {
  const folderPath = path.join(androidResPath, folder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  
  // Copy the logo file (we'll use yometel-logo.png as base)
  // In a real scenario, you'd convert logo.ico to PNG here
  if (fs.existsSync(sourceLogo)) {
    fs.copyFileSync(sourceLogo, path.join(folderPath, 'ic_launcher.png'));
    fs.copyFileSync(sourceLogo, path.join(folderPath, 'ic_launcher_round.png'));
    console.log(`✓ Created icons in ${folder}`);
  }
});

console.log('Logo conversion complete. Note: Using yometel-logo.png as base.');
console.log('For production, convert logo.ico to PNG using ImageMagick or similar tool.');
