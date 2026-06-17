const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'web-build'),
    filename: 'bundle.js',
    publicPath: '/', // ensure assets resolve from root for deep links
  },
  resolve: {
    extensions: ['.web.js', '.js', '.ts', '.tsx', '.json'],
    alias: {
      'react-native$': 'react-native-web',
      'react-native-qrcode-scanner': false,
      'react-native-camera': false,
      'react-native-permissions': false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules\/(?!(react-native-vector-icons)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              'module:metro-react-native-babel-preset',
            ],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/,
        type: 'asset/resource',
      },
      {
        test: /\.(ttf|otf|woff2?)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: 'body',
      favicon: path.resolve(__dirname, 'src/assets/logo-shield.png'),
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'web-build'),
    },
    compress: true,
    port: 3001,
    host: '0.0.0.0',
    // Accept any Host header so the server can sit behind a reverse proxy /
    // custom domain (e.g. dpp.innosynch.com) instead of only localhost.
    allowedHosts: 'all',
    // HMR can't reach the dev server through the HTTPS proxy, so turn off
    // hot/live reload in this hosted setup to avoid websocket reconnect noise.
    hot: false,
    liveReload: false,
    historyApiFallback: {
      index: '/index.html', // always serve index.html for SPA routes
      disableDotRule: true,
    },
  },
};
