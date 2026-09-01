const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Mode-aware config. `webpack serve` runs development (fast rebuilds, HMR);
// `webpack --mode production` (npm run web:build) produces a minified,
// code-split, content-hashed bundle for the hosted site. The hosted site MUST
// serve the production build — running `webpack serve` in production ships a
// ~2.7 MB unminified bundle with React in dev mode, which is the main cause of
// slow first loads.
module.exports = (env, argv) => {
  const isProd = (argv && argv.mode) === 'production';

  return {
    mode: isProd ? 'production' : 'development',
    entry: './index.web.js',
    // Real source maps in dev; cheap hidden maps in prod so we don't ship a
    // second multi-MB file to first-time visitors.
    devtool: isProd ? false : 'eval-cheap-module-source-map',
    output: {
      path: path.resolve(__dirname, 'web-build'),
      filename: isProd ? 'static/js/[name].[contenthash:8].js' : 'bundle.js',
      chunkFilename: isProd ? 'static/js/[name].[contenthash:8].chunk.js' : '[name].chunk.js',
      assetModuleFilename: isProd ? 'static/media/[hash][ext]' : '[hash][ext]',
      publicPath: '/', // ensure assets resolve from root for deep links
      clean: isProd, // wipe stale hashed assets on each prod build
    },
    optimization: isProd
      ? {
          minimize: true,
          runtimeChunk: 'single',
          moduleIds: 'deterministic',
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              // Pull the big rarely-changing libs (react-native-web,
              // navigation, zxing, axios…) into their own long-cached chunk so
              // repeat visits don't re-download them after an app-code change.
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                priority: 10,
              },
            },
          },
        }
      : undefined,
    performance: { hints: false },
    resolve: {
      extensions: ['.web.js', '.js', '.ts', '.tsx', '.json'],
      alias: {
        'react-native$': 'react-native-web',
        'react-native-qrcode-scanner': false,
        'react-native-camera': false,
        'react-native-permissions': false,
        '@invertase/react-native-apple-authentication': false,
        'react-native-worklets-core': false,
        '@react-native-ml-kit/barcode-scanning': false,
        'react-native-image-picker': false,
        // Native-only camera lib — the web build uses WebCodeScanner instead
        // (NativeCodeScanner/CaptureCameraView already guard their require()).
        // v4 re-exports skia/reanimated/worklets proxy modules from its entry
        // point; stub the whole package plus those transitive optional deps so
        // webpack doesn't try to resolve them.
        'react-native-vision-camera': false,
        '@shopify/react-native-skia': false,
        'react-native-reanimated': false,
        // Native-only GPS/device-info libs for the corporate capture flow —
        // deviceCapture.ts already branches to browser APIs on web.
        'react-native-geolocation-service': false,
        'react-native-device-info': false,
      },
    },
    module: {
      rules: [
        {
          // Several RN packages (@react-native-google-signin,
          // react-native-safe-area-context, @react-navigation…) ship an ESM
          // `lib/module` build whose relative imports omit file extensions.
          // Webpack 5 treats those as "fully specified" and errors; turning
          // that off lets `resolve.extensions` (which puts `.web.js` first)
          // pick the right file.
          test: /\.m?js$/,
          resolve: { fullySpecified: false },
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules\/(?!(react-native-vector-icons)\/).*/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                // loose:true so preset-env's class-properties / private-methods
                // / private-property-in-object transforms match the loose:true
                // that metro-react-native-babel-preset and babel.config.js use
                // — a mismatch spams a Babel warning for every source file.
                ['@babel/preset-env', { loose: true, targets: '> 0.5%, last 2 versions, not dead' }],
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
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!isProd),
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        inject: 'body',
        favicon: path.resolve(__dirname, 'src/assets/favicon.png'),
        minify: isProd && {
          collapseWhitespace: true,
          removeComments: true,
          minifyCSS: true,
        },
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
};
