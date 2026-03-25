// Script to create a simple QR code icon
// This creates a basic QR code pattern as an icon

const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

async function createQRIcon() {
  try {
    // Create a simple QR code with minimal data (just for icon appearance)
    const qrDataURL = await qrcode.toDataURL('QR', {
      width: 128,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Convert data URL to buffer
    const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to assets directory
    const assetsDir = path.join(__dirname, '../src/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const iconPath = path.join(assetsDir, 'qr-code-icon.png');
    fs.writeFileSync(iconPath, buffer);
    
    console.log('✓ QR code icon created at:', iconPath);
    return true;
  } catch (error) {
    console.error('Error creating QR icon:', error);
    return false;
  }
}

createQRIcon();
