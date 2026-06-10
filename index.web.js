import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Load react-native-vector-icons fonts on web. Without an @font-face the glyphs
// render as empty "tofu" rectangles, so we register the bundled .ttf files here.
import MaterialIconsFont from 'react-native-vector-icons/Fonts/MaterialIcons.ttf';
import MaterialCommunityIconsFont from 'react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf';

const iconFontFaces = `
@font-face { font-family: 'MaterialIcons'; src: url(${MaterialIconsFont}) format('truetype'); }
@font-face { font-family: 'MaterialCommunityIcons'; src: url(${MaterialCommunityIconsFont}) format('truetype'); }
`;
const iconFontStyle = document.createElement('style');
iconFontStyle.appendChild(document.createTextNode(iconFontFaces));
document.head.appendChild(iconFontStyle);

// Register the app for web
AppRegistry.registerComponent(appName, () => App);
AppRegistry.runApplication(appName, {
  initialProps: {},
  rootTag: document.getElementById('root'),
});
