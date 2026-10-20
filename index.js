/**
 * @format
 */

// Must stay the first import (see the file for why).
import './src/polyfills';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
