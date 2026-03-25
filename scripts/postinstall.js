const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '../node_modules/react-native-camera/android/build.gradle');

if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  
  // Add namespace if not present
  if (!content.includes('namespace "org.reactnative.camera"')) {
    content = content.replace(
      /android\s*\{[\s\S]*?compileSdkVersion/,
      'android {\n  namespace "org.reactnative.camera"\n  compileSdkVersion'
    );
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('✓ Fixed react-native-camera namespace');
  }
}
